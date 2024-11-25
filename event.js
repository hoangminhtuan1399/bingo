const fetchOptions = {
    method: 'POST', headers: {
        Authorization: 'Bearer 50291500:992e1f01-2451-4fc6-bed9-e7df5481e06d',
        Checksum: '02afccf9b76c80b3ef2ac24832ac4cdbd0e5c75329d92b2ef45959c152b35605'
    }
};

const fetchUrl = 'https://api.vietlott-sms.vn/mobile-api/customerAccount/getStatisticGbingoResult';

function handleGetOfflineTotal() {
    const arr = getValues();
    const counts = countTotal(arr, window.allResults);
    console.log(counts);
    displayResult(counts);
}

function handleGetOfflineTriple() {
    const arr = getValues();
    const counts = countTriple(arr, window.allResults);
    console.log(counts);
    displayResult(counts);
}

function handleGetOnlineTotal() {
    const arr = getValues();
    fetch(fetchUrl, fetchOptions).then(res => res.json()).then(json => {
        const counts = countTotal(arr, json.gbingoDraws);
        console.log(counts);
        displayResult(counts);
    });
}

async function handleGetOnlineTriple() {
    const arr = getValues();
    fetch(fetchUrl, fetchOptions).then(res => res.json()).then(json => {
        const counts = countTriple(arr, json.gbingoDraws);
        console.log(counts);
        displayResult(counts);
    });
}

function handleGetOnlineDouble() {
    fetch(fetchUrl, fetchOptions).then(res => {
        res.json().then(res => {
            const results = res.gbingoDraws;
            const arr = getValues();
            const counts = countDouble(arr, results);
            console.log(counts);
            displayResult(counts);
        });
    });
}

function handleGetOfflineDouble() {
    const arr = getValues();
    const counts = countDouble(arr, allResults);
    console.log(counts);
    displayResult(counts);
}

function getValues() {
    if (!document.querySelector('#check-value').value) return [];
    return document.querySelector('#check-value').value.split(', ').map((item) => parseInt(item));
}

function handleGetOfflineStatistic() {
    displayResult(getStatistic(window.allResults));
    console.log(getStatistic(window.allResults));
}

function createForm() {
    createAllResultForm();
    createIframe();
}

async function handleGetOnlineStatistic() {
    const allResults = await getOfflineData();
    displayResult(getStatistic(allResults));
    console.log(getStatistic(allResults));
}

function displayResult(result) {
    const element = document.querySelector('#result');
    element.innerHTML = JSON.stringify(result, null, 2);
}

async function getOfflineData() {
    const data = await fetch('data.json');
    return await data.json();
}