const express = require('express');
const bodyParser = require('body-parser');
const getCertificate = require('get-ssl-certificate');
const moment = require('moment');
const fs = require('fs');
const { parseString, Builder } = require('xml2js');
const app = express();
const port = 3000;

// XML dosyasının yolu
const xmlFilePath = './domainler.xml';

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// XML dosyasını oluşturma veya kontrol etme
function createOrCheckXmlFile() {
  if (!fs.existsSync(xmlFilePath)) {
    const initialXml = '<domains></domains>';
    fs.writeFileSync(xmlFilePath, initialXml, 'utf-8');
    console.log('XML dosyası oluşturuldu:', xmlFilePath);
  } else {
    console.log('XML dosyası mevcut:', xmlFilePath);
  }
}

createOrCheckXmlFile();

// Domain bilgilerini XML dosyasına kaydet
function saveDomainToXml(domain, startDate, endDate, remainingDays) {
  fs.readFile(xmlFilePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('XML dosyası okunamadı:', err);
      return;
    }

    parseString(data, (err, result) => {
      if (err) {
        console.error('XML verileri parse edilemedi:', err);
        return;
      }

      const newDomain = {
        name: domain,
        startDate: startDate,
        endDate: endDate,
        remainingDays: remainingDays
      };

      result.domains.domain.push(newDomain);

      const xmlBuilder = new Builder();
      const updatedXml = xmlBuilder.buildObject(result);

      fs.writeFile(xmlFilePath, updatedXml, 'utf-8', err => {
        if (err) {
          console.error('XML dosyası güncellenemedi:', err);
        } else {
          console.log('Domain bilgisi XML dosyasına kaydedildi.');
        }
      });
    });
  });
}

// SSL kontrolü endpoint'i
app.post('/check-ssl', async (req, res) => {
  try {
    const domain = req.body.domain;
    const certificate = await getCertificate.get(domain);

    const startDate = moment(certificate.valid_from, 'MMM DD HH:mm:ss YYYY GMT');
    const endDate = moment(certificate.valid_to, 'MMM DD HH:mm:ss YYYY GMT');
    const remainingDays = endDate.diff(moment(), 'days');

    const startDateFormatted = startDate.isValid() ? startDate.format('DD MMM YYYY HH:mm') : 'Bilinmiyor';
    const endDateFormatted = endDate.isValid() ? endDate.format('DD MMM YYYY HH:mm') : 'Bilinmiyor';
    const remainingDaysFormatted = remainingDays >= 0 ? remainingDays : 'Bilinmiyor';

    saveDomainToXml(domain, startDateFormatted, endDateFormatted, remainingDaysFormatted);

    res.json({
      startDate: startDateFormatted,
      endDate: endDateFormatted,
      remainingDays: remainingDaysFormatted
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
  }
});

// XML dosyasından verileri okuyarak arayüze gönderme
function loadDomainsFromXml(callback) {
  fs.readFile(xmlFilePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('XML dosyası okunamadı:', err);
      callback(err, null);
      return;
    }

    parseString(data, (err, result) => {
      if (err) {
        console.error('XML verileri parse edilemedi:', err);
        callback(err, null);
        return;
      }

      const domains = result.domains.domain.map(domain => ({
        name: domain.name[0],
        startDate: domain.startDate[0],
        endDate: domain.endDate[0],
        remainingDays: domain.remainingDays[0]
      }));

      callback(null, domains);
    });
  });
}

// Domain verilerini döndüren endpoint
app.get('/domains', (req, res) => {
  loadDomainsFromXml((err, domains) => {
    if (err) {
      console.error('XML verileri okunurken bir hata oluştu:', err);
      res.status(500).json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
      return;
    }

    res.json({ domains });
  });
});

// Yeni domain ekleme endpoint'i
app.post('/domains', (req, res) => {
  const domain = req.body.domain.trim();

  if (domain === '') {
    res.status(400).json({ error: 'Domain adı boş olamaz.' });
    return;
  }

  getCertificate.get(domain)
    .then(certificate => {
      const startDate = moment(certificate.valid_from, 'MMM DD HH:mm:ss YYYY GMT');
      const endDate = moment(certificate.valid_to, 'MMM DD HH:mm:ss YYYY GMT');
      const remainingDays = endDate.diff(moment(), 'days');

      const startDateFormatted = startDate.isValid() ? startDate.format('DD MMM YYYY HH:mm') : 'Bilinmiyor';
      const endDateFormatted = endDate.isValid() ? endDate.format('DD MMM YYYY HH:mm') : 'Bilinmiyor';
      const remainingDaysFormatted = remainingDays >= 0 ? remainingDays : 'Bilinmiyor';

      saveDomainToXml(domain, startDateFormatted, endDateFormatted, remainingDaysFormatted);

      // Güncellenen domain listesini geri döndür
      loadDomainsFromXml((err, domains) => {
        if (err) {
          console.error('XML verileri okunurken bir hata oluştu:', err);
          res.status(500).json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
          return;
        }
        res.json({ domains });
      });
    })
    .catch(error => {
      console.error(error);
      res.status(500).json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
    });
});

// Domain silme endpoint'i
app.delete('/domains/:domain', (req, res) => {
  const domain = req.params.domain;

  fs.readFile(xmlFilePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('XML dosyası okunamadı:', err);
      res.status(500).json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
      return;
    }

    parseString(data, (err, result) => {
      if (err) {
        console.error('XML verileri parse edilemedi:', err);
        res.status(500).json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
        return;
      }

      const domains = result.domains.domain;

      const updatedDomains = domains.filter(d => d.name[0] !== domain);

      result.domains.domain = updatedDomains;

      const xmlBuilder = new Builder();
      const updatedXml = xmlBuilder.buildObject(result);

      fs.writeFile(xmlFilePath, updatedXml, 'utf-8', err => {
        if (err) {
          console.error('XML dosyası güncellenemedi:', err);
          res.status(500).json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
        } else {
          // Güncellenen domain listesini geri döndür
          loadDomainsFromXml((err, domains) => {
            if (err) {
              console.error('XML verileri okunurken bir hata oluştu:', err);
              res.status(500).json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
              return;
            }
            res.json({ domains });
          });
        }
      });
    });
  });
});

// Sunucuyu başlat
app.listen(port, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${port}`);
});
