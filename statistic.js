function getStatistic(results) {
    const DAILY_COUNT = 160;
    let week = 0;
    let day = 0;
    let dayData = {};
    let weekData = {
        week_0: []
    };
    let x120 = 0;
    let x40 = 0;
    let x20 = 0;
    let h1 = 0, h2 = 0, h3 = 0, h4 = 0, h5 = 0, h6 = 0;
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const { winningResult } = result;
        const drawAt = new Date(result.drawAt);
        const dayOfWeek = drawAt.getDay();

        if (dayOfWeek == 1 && i % DAILY_COUNT == 0) {
            week++;
            weekData[`week_${week}`] = [];
        }

        if (i % DAILY_COUNT == 0) {
            day++;
            dayData[`day_${day}`] = [];
        }

        const mul = getMultiplier(winningResult);
        if (mul == 20) x20++;
        if (mul == 40) x40++;
        if (mul == 120) {
            x120++;
            switch (winningResult.toString()[0]) {
                case '1':
                    h1++;
                    break;
                case '2':
                    h2++;
                    break;
                case '3':
                    h3++;
                    break;
                case '4':
                    h4++;
                    break;
                case '5':
                    h5++;
                    break;
                default:
                    h6++;
                    break;
            }
        }
        dayData[`day_${day}`].push({
            winningResult,
            mul,
            drawAt
        });

        if (i % DAILY_COUNT == (DAILY_COUNT - 1)) {
            weekData[`week_${week}`].push(dayData[`day_${day}`]);
        }

        if ((dayOfWeek == 0 && i % DAILY_COUNT == (DAILY_COUNT - 1)) || i === results.length - 1) {
            weekData[`week_${week}`].push({
                x120,
                x40,
                x20,
                h1,
                h2,
                h3,
                h4,
                h5,
                h6
            });
            x120 = 0;
            x40 = 0;
            x20 = 0;
            h1 = 0;
            h2 = 0;
            h3 = 0;
            h4 = 0;
            h5 = 0;
            h6 = 0;
        }
    }
    return weekData;
}

function getMultiplier(winningResult) {
    if (checkTriple(winningResult)) return 120;
    const total = parseInt(winningResult[0]) + parseInt(winningResult[1]) + parseInt(winningResult[2]);
    return totalObject[total];
}

var totalObject = {
    3: 120,
    4: 40,
    5: 20,
    6: 12,
    7: 8,
    8: 5.5,
    9: 4.7,
    10: 4.4,
    11: 4.4,
    12: 4.7,
    13: 5.5,
    14: 8,
    15: 12,
    16: 20,
    17: 40,
    18: 120
};
