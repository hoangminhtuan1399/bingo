const fetchOptions = {
  method: 'POST', headers: {
    Authorization: 'Bearer 50291500:992e1f01-2451-4fc6-bed9-e7df5481e06d',
    Checksum: '02afccf9b76c80b3ef2ac24832ac4cdbd0e5c75329d92b2ef45959c152b35605'
  }
};

const fetchUrl = 'https://api.vietlott-sms.vn/mobile-api/customerAccount/getStatisticGbingoResult';

const fetchOffUrl = 'https://bingo18.top/data/data.json';

function handleGetOfflineTotal() {
  const arr = getValues();

  fetch(fetchOffUrl).then(res => res.json()).then(json => {
    const counts = {
      newest: json.gbingoDraws[json.gbingoDraws.length - 1],
      ...countTotal(arr, json.gbingoDraws)
    };
    console.log(counts);
    displayResult(counts);
  });
}

function handleGetOfflineTriple() {
  const arr = getValues();

  fetch(fetchOffUrl).then(res => res.json()).then(json => {
    const counts = {
      newest: json.gbingoDraws[json.gbingoDraws.length - 1],
      ...countTriple(arr, json.gbingoDraws)
    };
    console.log(counts);
    displayResult(counts);
  });
}

function handleGetOnlineTotal() {
  const arr = getValues();
  fetch(fetchUrl, fetchOptions).then(res => res.json()).then(json => {
    const counts = {
      newest: json.gbingoDraws[json.gbingoDraws.length - 1],
      ...countTotal(arr, json.gbingoDraws)
    };
    console.log(counts);
    displayResult(counts);
  });
}

async function handleGetOnlineTriple() {
  const arr = getValues();
  fetch(fetchUrl, fetchOptions).then(res => res.json()).then(json => {
    const counts = {
      newest: json.gbingoDraws[json.gbingoDraws.length - 1],
      ...countTriple(arr, json.gbingoDraws)
    };
    console.log(counts);
    displayResult(counts);
  });
}

function handleGetOnlineIndexStatistic() {
  fetch(fetchUrl, fetchOptions).then(res => {
    res.json().then(res => {
      const results = res.gbingoDraws;
      const arr = getValues();
      const counts = {
        newest: results[results.length - 1],
        ...countIndex(arr, results)
      };
      console.log(counts);
      displayResult(counts);
    });
  });
}

function getValues() {
  if (!document.querySelector('#check-value').value) return [];
  return document.querySelector('#check-value').value.split(' ').map((item) => parseInt(item));
}

function displayResult(result) {
  const element = document.querySelector('#result');
  element.innerHTML = JSON.stringify(result, null, 2);
}
