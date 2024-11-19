const url = 'https://bingo18.top/data/data.json';
const allResultFormElement = document.querySelector('#all-result-form');
window.allResults = [];
function createIframe() {
    const iframeElement = document.createElement('iframe');
    iframeElement.style.marginTop = '16px';
    iframeElement.src = url;
    allResultFormElement.append(iframeElement);
}

function removeAllResultForm() {
    allResultFormElement.innerHTML = '';
}

function createAllResultForm(callback) {
    removeAllResultForm();
    const formEle = document.createElement('form');
    Object.assign(formEle, {
        action: '',
        method: 'post',
        onsubmit(e) {
            allResultFormOnSubmit(e, callback)
        }
    })
    formEle.innerHTML = `
        <textarea name="allResult" id="all-result" cols="30" rows="10"></textarea>
            <br>
        <input type="submit" value="Submit">
    `
    allResultFormElement.append(formEle);
}

function allResultFormOnSubmit(e, callback = function() {}) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = JSON.parse(formData.get('allResult').toString());
    window.allResults = res.gbingoDraws;
    callback();
    removeAllResultForm();
}