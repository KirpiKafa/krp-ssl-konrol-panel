// XML verilerini çekme ve tabloya ekleme işlemleri
function loadDomainsFromXml() {
  fetch('/domains')
    .then(response => response.json())
    .then(data => {
      const domainTableBody = document.getElementById('domain-table-body');
      domainTableBody.innerHTML = '';

      data.domains.forEach(domain => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${domain.name}</td>
          <td>${domain.startDate}</td>
          <td>${domain.endDate}</td>
          <td>${domain.remainingDays}</td>
          <td>
            <button class="delete-domain" data-domain="${domain.name}">Sil</button>
          </td>
        `;

        domainTableBody.appendChild(row);
      });
    })
    .catch(error => console.error(error));
}

// Yeni domain ekleme işlemi
function addDomain() {
  const domainInput = document.getElementById('domain-input');
  const domain = domainInput.value.trim();

  if (domain !== '') {
    fetch('/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domain })
    })
      .then(response => response.json())
      .then(() => {
        domainInput.value = '';
        loadDomainsFromXml();
      })
      .catch(error => console.error(error));
  }
}

// Domain silme işlemi
function deleteDomain(domain) {
  fetch(`/domains/${domain}`, {
    method: 'DELETE'
  })
    .then(response => response.json())
    .then(() => loadDomainsFromXml())
    .catch(error => console.error(error));
}

// Sayfa yüklendiğinde domain verilerini çekme
document.addEventListener('DOMContentLoaded', () => {
  loadDomainsFromXml();
});

// Domain ekleme butonuna tıklama olayı
document.getElementById('domain-ekle').addEventListener('click', addDomain);

// Silme butonlarına tıklama olayı (event delegation)
document.getElementById('domain-table-body').addEventListener('click', event => {
  if (event.target.classList.contains('delete-domain')) {
    const domain = event.target.getAttribute('data-domain');
    deleteDomain(domain);
  }
});
