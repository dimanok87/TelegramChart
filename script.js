
var initChart = function() {

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

window.onload = initChart;

