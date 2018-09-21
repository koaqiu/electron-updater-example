const { ipcRenderer } = require('electron');
/**
 * 
 * @param {HTMLElement} el 
 * @param {string} selectors 
 */
function query(el, selectors) {
    const list = el.querySelectorAll(selectors);
    const array = [];
    for (let i = 0; i < list.length; i++) {
        array.push(list.item(i));
    }
    return array;
}
/**
 * @param {HTMLElement} el 
 */
function HtmlElement(el) {
    const _el = el;
    this.element = el;
    /**
     * 
     * @param {string} selectors 
     * @returns {HtmlElement[]}
     */
    this.query = function (selectors) {
        const list = _el.querySelectorAll(selectors);
        const array = [];
        for (let i = 0; i < list.length; i++) {
            array.push(new HtmlElement(list.item(i)));
        }
        return array;
    }
}
HtmlElement.Document = () => {
    return new HtmlElement(document);
}
/**
 * 
 * @param {string} tagName 
 * @returns {HTMLElement}
 */
function newElement(tagName) {
    return document.createElement(tagName);
}
const openNewWindow = (url) => {
    const canOpen = ipcRenderer.sendSync('check-url-can-open', url);
    if (canOpen) {
        // ipcRenderer.send('open-new-window', url);
        createNewWin(url, false);
    } else {
        console.warn('禁止打开以下网址：' + url);
        alert('禁止打开');
    }
}
/**
 * 
 * @param {HTMLElement} webView 
 * @param {HTMLElement} win 
 */
function attEven(webView, win) {
    const checkUrlCanOpen = (webView) => {
        return (event) => {
            const newUrl = event.type == 'did-get-redirect-request' ? event.newURL : event.url;
            const canOpen = ipcRenderer.sendSync('check-url-can-open', newUrl);
            // console.log(event.type, event.isMainFrame, newUrl, canOpen);
            if (!canOpen) {
                event.preventDefault();
                // event.stopPropagation();
                // window.close();
                webView.stop();
                console.warn('禁止打开以下网址：' + newUrl);
                if(event.isMainFrame === true){
                    webView.loadURL('data:text/html, <html><head><meta charset="utf-8"/><title>403</title></head><body>禁止打开以下网址：' + newUrl + '</body></html>');
                }
            }
        }
    }

    if (win) {
        const title = win.getElementsByClassName('title').item(0);
        webView.addEventListener('page-title-updated', (e) => {
            if (title)
                title.innerText = e.title;
        });
        win.getElementsByClassName('btn-close')
            .item(0)
            .addEventListener('click', function (event) {
                win.remove();
            });
    } else {
        webView.addEventListener('page-title-updated', (e) => {
            document.title = e.title;
        });
    }
    webView.addEventListener('new-window', (e) => {
        openNewWindow(e.url);
    });
    webView.addEventListener('did-navigate-in-page', checkUrlCanOpen(webView));
    webView.addEventListener('will-navigate', checkUrlCanOpen(webView))
    webView.addEventListener('did-get-redirect-request', checkUrlCanOpen(webView));
    webView.addEventListener('console-message', (e) => {
        console.log(e.message)
    })
    // const onload = () => {
    //     webView.removeEventListener('dom-ready', onload);
    //     console.log(webView.loadURL)
    //     // if (location.hash) {
    //     //     webView.loadURL(decodeURI(location.hash.substr(1)))
    //     // }
    // }
    // webView.addEventListener("dom-ready", onload);
}
function createNewWin(url, isMask) {
    function createWinHeader() {
        const header = newElement('div');
        header.style.cssText = 'width:100%;height:20px;background-color: #fff;border-bottom: #ccc 1px solid;box-shadow: #000 0px 0px 10px;';
        header.innerHTML = '<span class="title" style="font-size: 12px;padding-left: 5px;line-height: 20px;display: inline-block;overflow: hidden;height: 20px;-webkit-user-select: none;">loading...</span>'
            + '<div class="tool-bar" style="position:absolute;top: -10px;right: -5px;">'
            + '<button class="btn-close" style="border-radius: 50%;border: 1px solid #ccc;background-color: white;">x</button>'
            + '</div>'
        return header;
    }

    const win = newElement('div');
    win.className = 'webview-window';
    win.style.cssText = 'position:absolute;width:100%;height:100%;top:0;left:0;z-index:9999;'
        + (isMask ? 'background:rgba(0,0,0,0.5);' : 'background:transparent');

    const content = newElement('div');
    content.className = 'win-content';
    content.style.cssText = 'position:fixed;width:85%;left:7.5%;'
        + 'height:85%;'
        + 'top:7.5%;'
        + 'px;box-shadow:#555 0 0 20px 5px';

    const header = createWinHeader();

    const body = newElement('div');
    body.style.cssText = 'width:100%;height:calc(100% - 20px);background-color: #fff;';

    const webview = newElement('webview');
    webview.style.cssText = 'width:100%;height:100%;';
    webview.setAttribute('src', url);
    body.appendChild(webview);

    content.appendChild(header);
    content.appendChild(body);

    win.appendChild(content);
    document.body.appendChild(win);
    attEven(webview, win);
}

ipcRenderer.on('open-inner-window', function (event, url) {
    createNewWin(url, true);
});

ipcRenderer.on('close-window', function(event){
    const win = HtmlElement.Document().query('.webview-window')
        .pop();
    if(win){
        win.element.remove();
    }
});

// window.addEventListener('resize', function (event) {
//     const winDialgHeight = (window.innerHeight * .85);
//     const winDialgTop = (window.innerHeight - winDialgHeight) / 2
//     HtmlElement.Document().query('.webview-window .win-content')
//         //query(this.document, '.webview-window .win-content')
//         .map((win) => {
//             win.element.style.height = winDialgHeight.toString() + 'px';
//             win.element.style.top = winDialgTop.toString() + 'px';
//         })
// });
document.addEventListener('DOMContentLoaded', () => {
    if (location.hash) {
        const url = decodeURI(location.hash.substr(1))
        const webview = newElement('webview');
        webview.className = 'main-win';
        webview.setAttribute('src', url);
        attEven(webview, null);
        document.body.appendChild(webview);
    }
})