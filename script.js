function getTotal(winningResult) {
    return parseInt(winningResult[0]) + parseInt(winningResult[1]) + parseInt(winningResult[2]);
}

function checkTriple(winningResult) {
    const stringResult = winningResult.toString();
    return stringResult[0] === stringResult[1] && stringResult[1] === stringResult[2];
}

function checkDouble(nums, winningResult) {
    const stringResult = winningResult.toString();
    let rs = false;
    nums.forEach((num) => {
        num = num.toString();
        if (
            (stringResult[0] === num && stringResult[1] === num) ||
            (stringResult[0] === num && stringResult[2] === num) ||
            (stringResult[1] === num && stringResult[2] === num)
        ) {
            rs = true;
        }
    });
    return rs;
}

function countTotal(totalArr, results) {
    const res = [];
    let count = 1;
    results.forEach(({ winningResult, drawAt }, index) => {
        const total = getTotal(winningResult);
        if (totalArr.includes(total)) {
            res.push({ winningResult, count, index, drawAt });
            count = 1;
        } else if (index === results.length - 1) {
            res.push({ count, index });
            count = 1;
        } else {
            count++;
        }
    });
    res.push(getStandardDeviation(res));
    return getResultsByWeek(res);
}

function countTriple(tripleArr, results) {
    const res = [];
    let count = 1;
    results.forEach(({ winningResult, drawAt }, index) => {
        const isTriple = checkTriple(winningResult);
        if (isTriple) {
            const num = parseInt(winningResult.toString()[0]);
            if (!tripleArr || !tripleArr.length || tripleArr.includes(num)) {
                res.push({ winningResult, count, index, drawAt });
                count = 1;
            } else {
                count++;
            }
        } else if (index === results.length - 1) {
            res.push({
                count,
                index,
            });
            count = 1;
        } else {
            count++;
        }
    });
    res.push(getStandardDeviation(res));
    return getResultsByWeek(res);
}

function countDouble(nums, results) {
    const res = [];
    let count = 1;
    results.forEach(({ winningResult }, index) => {
        if (checkDouble(nums, winningResult)) {
            res.push({ winningResult, count, index });
            count = 1;
        } else if (index === results.length - 1) {
            res.push({ count, index });
            count = 1;
        } else {
            count++;
        }
    });
    return res;
}

function getStatisticAll(results) {
    const res = {
        trip_1: {
            double: countDouble(1, results),
            total: countTotal([3], results),
            triple: countTriple([], results),
        },
        trip_2: {
            double: countDouble(2, results),
            total: countTotal([6], results),
            triple: countTriple([], results),
        },
        trip_3: {
            double: countDouble(3, results),
            total: countTotal([9], results),
            triple: countTriple([], results),
        },
        trip_4: {
            double: countDouble(4, results),
            total: countTotal([12], results),
            triple: countTriple([], results),
        },
        trip_5: {
            double: countDouble(5, results),
            total: countTotal([15], results),
            triple: countTriple([], results),
        },
        trip_6: {
            double: countDouble(6, results),
            total: countTotal([18], results),
            triple: countTriple([], results),
        },
        total_4: {
            double_1: countDouble(1, results),
            total: countTotal([4], results),
        },
        total_17: {
            double_6: countDouble(6, results),
            total: countTotal([17], results),
        },
        total_5: {
            double_1: countDouble(1, results),
            double_2: countDouble(2, results),
            total: countTotal([5], results),
        },
        total_16: {
            double_6: countDouble(6, results),
            double_5: countDouble(5, results),
            total: countTotal([16], results),
        },
    };
    return res;
}

function getStandardDeviation(arr) {
    const array = arr.filter((rs) => !!rs.winningResult).map((rs) => rs.count);
    const n = array.length;
    const mean = array.reduce((a, b) => a + b) / n;
    const sa = Math.sqrt(array.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
    return {
        mean,
        sa,
    };
}

function calculatePayMoney(multiplier, count) {
    let totalPay = 0;
    let maxPay = 10;
    let flag = true;
    let payList = [];
    for (let i = 0; i < count; i++) {
        do {
            let threshHold = maxPay * multiplier;
            if (totalPay + maxPay > threshHold) {
                flag = true;
                maxPay += 10;
            } else {
                flag = false;
            }
        } while (flag);
        totalPay += maxPay;
        payList.push({
            totalPay,
            maxPay,
            winning: maxPay * multiplier - totalPay,
        });
    }
    return {
        payList,
        totalPay,
        maxPay,
    };
}

function calculateProfit(countList, multiplier, min, max) {
    const payCount = max - min;
    const statistic = calculatePayMoney(multiplier, payCount);
    const maxLoss = statistic.totalPay;
    const payList = statistic.payList;
    let winning = 0;
    let losing = 0;
    countList.forEach((count) => {
        if (count < min) return;
        if (count >= max) {
            losing += maxLoss;
            return;
        }
        const index = count - min;
        winning += payList[index].winning;
    });
    return {
        winning,
        losing,
        total: winning - losing,
    };
}

function getResultsByWeek(results) {
    let week = 0;
    let firstWeek = getWeekNumber(new Date(results[0].drawAt));
    const weekData = {
        week_0: [],
    };
    results.forEach((result, index) => {
        const { drawAt } = result;
        const weekOfMonth = getWeekNumber(new Date(drawAt));
        if (weekOfMonth != firstWeek) {
            week++;
            weekData[`week_${week}`] = [];
            firstWeek = weekOfMonth;
        }
        weekData[`week_${week}`].push(result);
    });

    return weekData;
}

function getWeekNumber(date) {
  const janFirst = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date.getTime() - janFirst.getTime()) / 86400000) + janFirst.getDay() - 1) / 7);
}