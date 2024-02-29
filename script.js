function countTotal(totalArr, results) {
    const res = [];
    let count = 1;
    results.forEach(({ winningResult }, index) => {
        const total = getTotal(winningResult).toString();
        if (totalArr.includes(total) || index === results.length - 1) {
            res.push({ count, index });
            count = 1;
        } else {
            count++;
        }
    });
    return res;
}

function countTriple(tripleArr, results) {
    const res = [];
    let count = 1;
    results.forEach(({ winningResult }, index) => {
        const isTriple = checkTriple(winningResult);
        if (isTriple) {
            const num = winningResult.toString()[0];
            if (!tripleArr || !tripleArr.length || tripleArr.includes(num)) {
                res.push({ count, index });
                count = 1;
            } else {
                count++;
            }
        } else if (index === results.length - 1) {
            res.push({
                count, index
            });
            count = 1;
        } else {
            count++;
        }
    });
    return res;
}

function getTotal(winningResult) {
    return parseInt(winningResult[0]) + parseInt(winningResult[1]) + parseInt(winningResult[2]);
}

function checkTriple(winningResult) {
    const stringResult = winningResult.toString();
    return stringResult[0] === stringResult[1] && stringResult[1] === stringResult[2];
}
