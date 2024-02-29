const fetchOptions = {
    method: 'POST',
    headers: {
        Authorization: 'Bearer 50291500:992e1f01-2451-4fc6-bed9-e7df5481e06d',
        Checksum: '02afccf9b76c80b3ef2ac24832ac4cdbd0e5c75329d92b2ef45959c152b35605'
    }
};

const fetchUrl = 'https://api.vietlott-sms.vn/mobile-api/customerAccount/getStatisticGbingoResult';

function handleGetOnlineTotal() {
    fetch(fetchUrl, fetchOptions).then(res => {
        res.json().then(res => {
            const results = res.gbingoDraws;
            const arr = getValues();
            const counts = countTotal(arr, results);
            console.log(counts);
        });
    });
}

function handleGetOnlineTriple() {
    fetch(fetchUrl, fetchOptions).then(res => {
        res.json().then(res => {
            const results = res.gbingoDraws;
            const arr = getValues();
            const counts = countTriple(arr, results);
            console.log(counts);
        });
    });
}

function getValues() {
    if (!document.querySelector('#check-value').value) return [];
    return document.querySelector('#check-value').value.split(', ');
}

function handleGetStatistic() {
    const res = statistics.filter(({ playType }) => {
        return true
    }).map(({ playType, countUserBought, amount }) => {
        return {
            playType,
            amount,
            countUserBought,
            ratio: amount / countUserBought
        };
    }).sort((a, b) => {
        const nameA = a.playType.toLowerCase();
        const nameB = b.playType.toLowerCase();
        if (nameA < nameB) {
            return -1;
        }
        if (nameA > nameB) {
            return 1;
        }
        return 0;
    });
    console.log(res);
}