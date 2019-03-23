

var getXmlHttp = function() {
    var xmlhttp;
    try {
        xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
    } catch (e) {
        try {
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        } catch (E) {
            xmlhttp = false;
        }
    }
    if (!xmlhttp && typeof XMLHttpRequest!='undefined') {
        xmlhttp = new XMLHttpRequest();
    }
    return xmlhttp;
};

var initChart = function() {
    var xhr = getXmlHttp();

    var body = document.getElementsByTagName('body')[0];
    var metaColorsTags = document.getElementsByClassName('browser-theme-color');

    var themeColors = {
        'default': '#eeeeee',
        'night': '#242f3e'
    };

    var selectedTheme = 'default';

    var switchTheme = function () {
        switch (selectedTheme) {
            case 'default':
                selectedTheme = 'night';
                body.className = 'dark-theme';
                break;
            case 'night':
                selectedTheme = 'default';
                body.className = 'default-theme';
        }

        for (var k = 0; k < metaColorsTags.length; k++) {
            metaColorsTags[k].setAttribute('content', themeColors[selectedTheme]);
        }
    };

    var themeSwitcher = document.getElementById('theme-switcher');

    themeSwitcher.addEventListener ?
        themeSwitcher.addEventListener('click', switchTheme, false) :
        themeSwitcher.attachEvent("onclick", switchTheme);


    var charts = document.getElementById('charts-list');

    xhr.open('GET', 'data.json', true);
    xhr.send();
    xhr.onreadystatechange = function() {
        if (xhr.readyState != 4) return;
        if (xhr.status != 200) {
            console.log(xhr.status + ': ' + xhr.statusText);
        } else {
            setDataToCharts(JSON.parse(xhr.responseText));
        }
    };

    var setDataToCharts = function(chartsData) {
        chartsData.forEach(function(chartData, index) {
            var chartDomContainer = document.createElement('div');
            chartDomContainer.className = 'one-chart-block';

            var chartDom = document.createElement('div');
            chartDom.className = 'one-chart-container';

            var chartTitle = document.createElement('div');
            chartTitle.className = 'one-chart-title';

            chartTitle.innerText = 'Chart #' + (index + 1);

            chartDomContainer.appendChild(chartTitle);


            chartDomContainer.appendChild(chartDom);
            charts.appendChild(chartDomContainer);
            var chart = new Chart(chartDom);

            chart.setData(chartData);

        });
    };

};

window.onload = initChart;

