

function Chart(_element) {


    // Default options
    var _options = this._defaultOptions;
    var invisibleButtonSize = 24;

    // Constants

    var MONTHS_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Act', 'Nov', 'Dec'];
    var DAYS_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    var SVG_NS = "http://www.w3.org/2000/svg";
    var CLIP_PATH_ID = 'chartGroup';
    var ANIMATION_FPS = 22;


    var formatNumber = function(n) {
        return n.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ');
    };

    var preventDefault = function(e) {
        e = e || window.event;
        if (e.preventDefault)
            e.preventDefault();
        e.returnValue = false;
    };

    // Static functions

    var ASSOCIATIONS_EVENTS = {
        'mousedown': ['mousedown', 'touchstart'],
        'mousemove': ['mousemove', 'touchmove'],
        'mouseup': ['mouseup', 'touchend', 'touchcancel'],
        'mouseenter': ['mouseenter']
    };
    var polyFillAddEvent = function (elem, type, handler) {
        elem.addEventListener ?
            elem.addEventListener(type, handler, false) :
            elem.attachEvent("on" + type, handler);
    };
    var polyFillRemoveEvent = function (elem, type, handler) {
        elem.removeEventListener ?
            elem.removeEventListener(type, handler) :
            elem.detachEvent("on" + type, handler);
    };

    var addEvent = function (elem, type, handler) {
        ASSOCIATIONS_EVENTS[type].forEach(function (eventType) {
            polyFillAddEvent(elem, eventType, handler);
        });
    };
    var removeEvent = function (elem, type, handler) {
        ASSOCIATIONS_EVENTS[type].forEach(function (eventType) {
            polyFillRemoveEvent(elem, eventType, handler);
        });
    };

    var getClientX = function (event, identifier) {
        switch (event.type) {
            case 'mousedown':
            case 'mousemove':
                return event.clientX;
                break;
            case 'touchstart':
                return event.touches[0].clientX;
                break;
            case 'touchmove':
                if (!isNaN(identifier)) {
                    for (var t = 0; t < event.touches.length; t++) {
                        if (identifier === event.touches[t]['identifier']) {
                            return event.touches[t].clientX;
                        }
                    }
                } else {
                    return event.touches[0].clientX;
                }
                break;
        }
    };

    var svgElement = function (nodeName) {
        return document.createElementNS(SVG_NS, nodeName)
    };

    var buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'chart-buttons-container';

    var createButton = function(chartData) {
        var button = document.createElement('label');
        button.className = 'switch-chart-displaying no-animated';
        button.innerHTML = '<input type="checkbox" checked>' +
            '<span class="switch-chart-displaying_btn">' +
            '<span class="btn-shadow"></span>' +
            '<span class="switch-chart-displaying_btn_ico">' +
            '<svg width="24" height="24">' +
            '<circle cx="12" cy="12" r="12" class="check-c-color"></circle>' +
            '<circle cx="12" cy="12" r="10.8" class="check-c"></circle>' +
            '<g class="check-i">' +
            '<path d="m 21.886911,6.4807205 c 0.786055,-0.7760093 2.052359,-0.7678652 2.828368,0.01819 0.77601,0.7860556 0.767866,2.0523594 -0.01819,2.8283687 l -12.519,12.3590008 c -0.755977,0.746314 -1.963511,0.771407 -2.7498386,0.05714 l -5.565,-5.055 C 3.045636,15.945737 2.9848936,14.680865 3.7275783,13.86325 4.470263,13.045636 5.7351353,12.984894 6.5527496,13.727578 l 4.1630234,3.781507 z"fill="#ffffff"/>' +
            '</g>' +
            '</svg>' +
            '</span>' +
            '<span class="switch-chart-displaying_btn_txt"></span>' +
            '</span>' +
            '</label>';
        buttonsContainer.appendChild(button);
        var txt = button.querySelector('.switch-chart-displaying_btn_txt');
        var circleColor = button.querySelector('.check-c-color');
        var animCircleColor = button.querySelector('.check-c');

        animCircleColor.style.transition = 'r 0.15s linear';

        var checkBox = button.querySelector('input');
        var animButton = function() {
            animCircleColor.setAttribute('r', !checkBox.checked ? '10.8' : '0');
        };
        polyFillAddEvent(checkBox, 'change', animButton);
        animButton();
        txt.innerText = chartData.name;
        circleColor.setAttribute('fill', chartData.color);
        checkBox.onclick = function() {
            if (_chartState.animatedPreview) return false;
            toggleChartVisibility(chartData);
        };
        button.className = 'switch-chart-displaying';
    };


    // Элементы разметки
    var _animateControlCircle = svgElement('circle');
    _animateControlCircle.setAttribute('class', 'chart-control-animation');
    _animateControlCircle.style.transition = 'r ' + _options.CSSduration + ', opacity ' + _options.CSSduration + '';
    _animateControlCircle.setAttribute('cy', _options.previewHeight / 2);
    _animateControlCircle.setAttribute('r', _options.previewHeight / 2);

    var _controlsRect =  svgElement('circle');
    _controlsRect.setAttribute('cy', _options.previewHeight / 2);
    _controlsRect.setAttribute('r', _options.previewHeight / 2);
    _controlsRect.setAttribute('cx', _options.previewOutside.left / 2);

    var
        // Для установки размеров холста
        _svgCanvas = svgElement('svg'),

        // Для установки позиции видимой области
        _allElementsGroup = svgElement('g'),

        // Для ограничения видимой области
        _visibleRect = svgElement('rect'),

        // Для позиционирования превью графиков
        _previewGroup = svgElement('g'),

        // Группа превью графиков
        _chartsPreview = svgElement('g'),

        // Для позиционирования и управления сеткой
        _gridsGroup = svgElement('g'),

        // Для Позиционирования и управления значениями на оси X
        _datesGroup = svgElement('g'),

        // Для позиционирования и управления графиками в главной области
        _chartGroup = svgElement('g'),

        // Видимые прямоугольники превью
        _scaleControls = svgElement('g'),

        // Невидимые функциональные элементы
        _invisibleControlsPreview = svgElement('g'),

        // Группа затенения графиков в превью для установки темы
        _shadowsPreview = svgElement('g'),


        // Группа с точками для отображения на графике
        _pointsGroup = svgElement('g'),

        _pointCircle = svgElement('circle'),

        _pointLine = svgElement('line'),

        _chartControls = {
            rectangles: {
                outside: svgElement('rect'),
                inside: svgElement('rect')
            },
            shadows: {
                left: svgElement('rect'),
                right: svgElement('rect')
            },
            controls: {
                left: svgElement('g'),
                right: svgElement('g'),
                move: svgElement('g')
            },
            controlsCircles: {
                left: _animateControlCircle.cloneNode(false),
                right: _animateControlCircle.cloneNode(false),
                move: _animateControlCircle.cloneNode(false)
            },
            controlsButtons: {
                left: _controlsRect.cloneNode(false),
                right: _controlsRect.cloneNode(false),
                move: svgElement('rect')
            }
        };

    _pointCircle.setAttribute('class', 'chart-point-value-circle');
    _pointCircle.setAttribute('r', '3.6');

    _chartControls.controlsButtons.move.setAttribute('id', 'move-sizer');

    var pointsInfoTooltip = document.createElement('div');
    pointsInfoTooltip.className = 'chart-info-tooltip';
    var infoContentTooltip = document.createElement('div');
    infoContentTooltip.setAttribute("style",
        "padding: 0 6px;"
    );

    pointsInfoTooltip.appendChild(infoContentTooltip);
    var infoDateTooltip = document.createElement('div');
    infoDateTooltip.className = 'chart-info-tooltip-date';

    infoContentTooltip.appendChild(infoDateTooltip);

    var infoPointsTooltip = document.createElement('div');
    infoContentTooltip.appendChild(infoPointsTooltip);

    var setSelectedDatePoints = function(tsDate) {
        infoDateTooltip.innerText = tsDate.infoDate;
    };

    var createChartInfoItem = function(chartData) {
        var oneChartInfoBlock =  document.createElement('div');
        var oneChartInfoValue =  document.createElement('div');
        oneChartInfoBlock.setAttribute('style',
            "color: " + (chartData.color) + ";" +
            "padding: 6px;" +
            "vertical-align: middle;" +
            "float: left;" +
            "box-sizing: border-box;" +
            "white-space: nowrap;"
        );

        oneChartInfoValue.setAttribute('style',
            "font-size: 16.4px;" +
            "font-weight: bold;"
        );

        var oneChartInfoName =  document.createElement('div');
        oneChartInfoName.innerText = chartData.name;
        oneChartInfoName.style.fontSize = '12px';
        oneChartInfoBlock.appendChild(oneChartInfoValue);
        oneChartInfoBlock.appendChild(oneChartInfoName);
        infoPointsTooltip.appendChild(oneChartInfoBlock);

        return {
            valueNode: oneChartInfoValue,
            baseNode: oneChartInfoBlock
        };
    };

    _element.style.position = 'relative';

    // Линии сетки для клонирования
    var oneStepGroupEl = svgElement('g');
    var oneLinePathEl = svgElement('line');
    oneLinePathEl.setAttribute('class', 'chart-grid-line-g-line');

    var shadowLineTextEl = svgElement('text');
    shadowLineTextEl.setAttribute('class', 'chart-grid-line-g-st');
    shadowLineTextEl.setAttribute('dy', '-5');

    var oneLineTextEl = svgElement('text');
    oneLineTextEl.setAttribute('class', 'chart-grid-line-g-bt');
    oneLineTextEl.setAttribute('dy', '-5');

    oneLinePathEl.setAttribute('x1', '0');
    oneLinePathEl.setAttribute('y1', '0');
    oneLinePathEl.setAttribute('y2', '0');

    oneStepGroupEl.style.transition = 'opacity ' + _options.CSSduration + ' linear';
    oneStepGroupEl.style.opacity = '0';


    var dateGroupEl = svgElement('g');
    dateGroupEl.style.transition = 'opacity 0.15s linear';
    dateGroupEl.style.opacity = 0;

    var svgDateEl = svgElement('text');
    svgDateEl.setAttribute('text-anchor', 'middle');

    var svgRectDateEl = svgElement('rect');

    var generateChartLayouts = function () {

        // Весь холст
        var CanvasContainer = document.createElement('div');
        CanvasContainer.className = 'chart-canvas-container';

        var svgCanvasContainer = document.createElement('div');
        svgCanvasContainer.className = 'chart-svg-canvas-container';
        CanvasContainer.appendChild(pointsInfoTooltip);
        CanvasContainer.appendChild(svgCanvasContainer);

        svgCanvasContainer.appendChild(_svgCanvas);
        _element.appendChild(CanvasContainer);

        _element.appendChild(buttonsContainer);

        // Элемент с доп. опциями
        var defsElement = svgElement('defs');
        _svgCanvas.appendChild(defsElement);

        var chartClip = svgElement('clipPath');
        chartClip.setAttribute('id', CLIP_PATH_ID);
        defsElement.appendChild(chartClip);

        chartClip.appendChild(_visibleRect);

        _allElementsGroup.style.clipPath = 'url(#' + CLIP_PATH_ID + ')';
        _svgCanvas.appendChild(_allElementsGroup);

        // Элементы превью
        _allElementsGroup.appendChild(_previewGroup);

        // Отображамый прямоугольник превью
        _scaleControls.appendChild(_chartControls.rectangles.outside);
        _scaleControls.appendChild(_chartControls.rectangles.inside);
        _previewGroup.appendChild(_scaleControls);

        // Превью графиков
        _previewGroup.appendChild(_chartsPreview);

        // Затенение графиков
        _previewGroup.appendChild(_shadowsPreview);
        _shadowsPreview.appendChild(_chartControls.shadows.left);
        _shadowsPreview.appendChild(_chartControls.shadows.right);


        _previewGroup.appendChild(_invisibleControlsPreview);

        _invisibleControlsPreview.appendChild(_chartControls.controls.move);
        _invisibleControlsPreview.appendChild(_chartControls.controls.left);
        _invisibleControlsPreview.appendChild(_chartControls.controls.right);

        _chartControls.controls.left.appendChild(_chartControls.controlsCircles.left);
        _chartControls.controls.left.appendChild(_chartControls.controlsButtons.left);
        _chartControls.controls.move.appendChild(_chartControls.controlsCircles.move);
        _chartControls.controls.move.appendChild(_chartControls.controlsButtons.move);
        _chartControls.controls.right.appendChild(_chartControls.controlsCircles.right);
        _chartControls.controls.right.appendChild(_chartControls.controlsButtons.right);


        _chartControls.controlsCircles.left.setAttribute('cx', _options.previewOutside.left / 2);
        _chartControls.controlsCircles.right.setAttribute('cx', _options.previewOutside.left / 2);

        // График
        _allElementsGroup.appendChild(_chartGroup);


        // Точки значений
        _allElementsGroup.appendChild(_pointsGroup);
        _pointsGroup.appendChild(_pointLine);
        _pointsGroup.style.transition = 'opacity ' + _options.CSSduration + ' linear';
        _pointsGroup.style.opacity = 0;


        // Сетка
        _allElementsGroup.appendChild(_gridsGroup);


        // Ось X
        _allElementsGroup.appendChild(_datesGroup);
        svgRectDateEl.setAttribute('width', _options.xAxisItemSize);
        svgRectDateEl.setAttribute('height', _options.xAxisHeight);
        svgRectDateEl.setAttribute('fill', 'transparent');
        svgRectDateEl.setAttribute('transform', 'translate(-' + (_options.xAxisItemSize / 2) + ', -18)');
    };


    // Размеры, позиции и их инициализация

    var
        // Размер отображаемой части
        _canvasViewSizes;


    var setPreviewSizes = function() {
        var previewSize = _chartState.width * _canvasViewSizes.width;
        _chartControls.rectangles.outside.setAttribute('width', previewSize);
        _chartControls.rectangles.inside.setAttribute('width', previewSize - _options.previewOutside.left * 2);

        _chartState.onePointWidth = _canvasViewSizes.width / (_chartState.endFloatPoint - _chartState.startFloatPoint - 1);


        _chartControls.controlsButtons.move.setAttribute('width', previewSize - _options.previewOutside.left * 2);
        _chartControls.controls.right.setAttribute('transform', 'translate(' + (previewSize - _options.previewOutside.left) + ', 0)');
        _chartControls.controlsCircles.move.setAttribute('cx', previewSize / 2  - _options.previewOutside.left);

        var stepXAxis = (_chartData.xAxis.data.length / _options.xAxisCount * _chartState.width) || 1;
        _chartState.stepXAxis = Math.max(Math.pow(2, Math.ceil(Math.log(stepXAxis) / Math.log(2))), 1);
        _chartState.xAxisInterval = _chartState.onePointWidth * _chartState.stepXAxis;
    };

    var setLeftPosPreview = function() {
        var leftPosition = _chartState.start * _canvasViewSizes.width;
        _scaleControls.setAttribute('transform', 'translate(' + leftPosition + ', 0)');
        _chartControls.shadows.left.setAttribute('width', leftPosition || 1);
        _chartState.startFloatPoint = _chartState.start * _chartData.xAxis.data.length;
        _chartState.startPoint = Math.floor(_chartState.startFloatPoint);
        _invisibleControlsPreview.setAttribute('transform', 'translate(' + leftPosition + ', 0)');
    };

    var setRightPosPreview = function() {
        var rightPosition = _chartState.end * _canvasViewSizes.width;
        _chartControls.shadows.right.setAttribute('width', (_canvasViewSizes.width - rightPosition) || 1);
        _chartControls.shadows.right.setAttribute('x', rightPosition);

        _chartState.endFloatPoint = _chartState.end * _chartData.xAxis.data.length;
        _chartState.endPoint = Math.ceil(_chartState.endFloatPoint);
    };

    var _chartState;

    var iniElementsSizes = function () {
        _chartState = _chartState || {
            start: _options.startViewPosition[0],
            end: _options.startViewPosition[1],
            width: _options.startViewPosition[1] - _options.startViewPosition[0],

            visibleXAxisPoints: [],
            gridLines: []
        };

        var svgSizes = {
            width: _element.offsetWidth,
            height: _element.offsetHeight
        };

        _chartState.canvasSize = svgSizes;

        _canvasViewSizes = {
            width: svgSizes.width - _options.padding.left * 2,
            height: svgSizes.height - _options.padding.top * 2
        };

        buttonsContainer.style.padding = _options.padding.left;

        _svgCanvas.setAttribute('width', svgSizes.width);
        _svgCanvas.setAttribute('height', svgSizes.height);

        _svgCanvas.style['-moz-user-select'] =  'none';
        _svgCanvas.style['-ms-user-select'] =  'none';
        _svgCanvas.style['-khtml-user-select'] =  'none';
        _svgCanvas.style['-webkit-user-select'] =  'none';
        _svgCanvas.style['-webkit-touch-callout'] =  'none';


        _allElementsGroup.setAttribute('transform', 'translate(' + _options.padding.left + ', ' + _options.padding.top + ')');

        _visibleRect.setAttribute('x', '0');
        _visibleRect.setAttribute('y', '0');
        _visibleRect.setAttribute('width', _canvasViewSizes.width);
        _visibleRect.setAttribute('height', (_canvasViewSizes.height + _options.padding.top));


        var previewOffset = _canvasViewSizes.height - _options.previewHeight;
        _previewGroup.setAttribute('transform', 'translate(0, ' + previewOffset + ')');

        _chartControls.rectangles.outside.setAttribute('y', '0');
        _chartControls.rectangles.outside.setAttribute('x', '0');
        _chartControls.rectangles.outside.setAttribute('height', _options.previewHeight);

        _chartControls.rectangles.inside.setAttribute('x', _options.previewOutside.left);
        _chartControls.rectangles.inside.setAttribute('y', _options.previewOutside.top);
        _chartControls.rectangles.inside.setAttribute('height', _options.previewHeight - _options.previewOutside.top * 2);

        _chartControls.shadows.left.setAttribute('x', '0');
        _chartControls.shadows.left.setAttribute('y', '0');
        _chartControls.shadows.left.setAttribute('height', _options.previewHeight);

        _chartControls.shadows.right.setAttribute('y', '0');
        _chartControls.shadows.right.setAttribute('height', _options.previewHeight);

        _chartControls.controls.left.setAttribute('transform', 'translate(0, 0)');
        _chartControls.controls.right.setAttribute('transform', 'translate(0, 0)');

        _chartControls.controls.move.setAttribute('transform', 'translate(' + _options.previewOutside.left + ', 0)');
        _chartControls.controlsButtons.move.setAttribute('height', _options.previewHeight);

        _chartGroup.setAttribute('transform', 'translate(0, ' + (previewOffset - _options.xAxisHeight) + ')');
        _gridsGroup.setAttribute('transform', 'translate(0, ' + (previewOffset - _options.xAxisHeight) + ')');

        _datesGroup.setAttribute('transform', 'translate(0, ' + (previewOffset - _options.xAxisHeight + 18) + ')');
        _pointsGroup.setAttribute('transform', 'translate(0, ' + (previewOffset - _options.xAxisHeight) + ')');
        _options.xAxisCount = _canvasViewSizes.width / _options.xAxisItemSize;
        _options.baseChartHeight = _canvasViewSizes.height - _options.previewHeight - _options.xAxisHeight;
        _options.gridCount = Math.floor(_options.baseChartHeight / _options.gridItemHeight);

        _options.previewPadding = _options.previewHeight * 0.1;
    };

    var applyColorTheme = function() {
        _shadowsPreview.setAttribute('stroke', '0');
        _shadowsPreview.setAttribute('class', 'chart-preview-shadows');

        _chartControls.rectangles.outside.setAttribute('stroke', '0');
        _chartControls.rectangles.outside.setAttribute('class', 'chart-preview-outside');

        _chartControls.rectangles.inside.setAttribute('stroke', '0');
        _chartControls.rectangles.inside.setAttribute('class', 'chart-preview-inside');

        _datesGroup.setAttribute('class', 'chart-grid-xaxis-values');

        _gridsGroup.setAttribute('class', 'chart-grid-line-g');
        _pointLine.setAttribute('class', 'chart-grid-value-line');

        _invisibleControlsPreview.setAttribute('fill-opacity', '0');
    };


    var addControlsHandlers = function() {

        var _startMovePosition = {},
            _previewDownPositions;

        var downIdentifiers = {
            left: undefined,
            right: undefined,
            move: undefined
        };

        var removeAllHandlers = function() {
            removeEvent(_chartControls.controls.move, 'mousedown', moverDown);
            removeEvent(_chartControls.controls.left, 'mousedown', sizerLeftDown);
            removeEvent(_chartControls.controls.right, 'mousedown', sizerRightDown);
            removeEvent(_shadowsPreview, 'mousedown', shadowsDown);
        };
        var iniCommonDown = function(event, touchElement) {
            event.stopPropagation();
            preventDefault(event);
            _startMovePosition[touchElement] = getClientX(event);
            _previewDownPositions = {
                start: _chartState.start,
                end: _chartState.end,
                size: _chartState.width,
                maxLeft: -_chartState.start,
                maxRight: 1 - _chartState.end,
                minSize: _chartState.width - _options.minimumVisiblePoints / _chartData.xAxis.data.length
            };
            removeAllHandlers();
        };

        var upControl = function() {
            addEvent(_chartControls.controls.move, 'mousedown', moverDown);
            addEvent(_chartControls.controls.left, 'mousedown', sizerLeftDown);
            addEvent(_chartControls.controls.right, 'mousedown', sizerRightDown);
            addEvent(_shadowsPreview, 'mousedown', shadowsDown);
        };

        var moverUp = function() {
            removeEvent(window, 'mousemove', moverMove);
            removeEvent(window, 'mouseup', moverUp);

            setTimeout(function() {
                _chartControls.controlsCircles.move.setAttribute('r', 0);
                _chartControls.controlsCircles.move.style.opacity = 0;
            });
            upControl();

        };
        var moverMove = function(event) {
            preventDefault(event);
            var rangePercentsMove = (getClientX(event, downIdentifiers.move) - _startMovePosition['move']) / _canvasViewSizes.width;
            rangePercentsMove = Math.max(Math.min(rangePercentsMove, _previewDownPositions.maxRight), _previewDownPositions.maxLeft);

            _chartState.start = _previewDownPositions.start + rangePercentsMove;
            _chartState.end = _previewDownPositions.end + rangePercentsMove;
            _chartState.width = _chartState.end - _chartState.start;

            setLeftPosPreview();
            setRightPosPreview();
            drawBaseChart();
            return false;
        };
        var moverDown = function(event) {
            if (event.targetTouches && event.targetTouches.length) {
                downIdentifiers.move = event.targetTouches[0].identifier;
            }
            iniCommonDown(event, 'move');
            addEvent(window, 'mousemove', moverMove);
            addEvent(window, 'mouseup', moverUp);

            _chartControls.controlsCircles.move.setAttribute('r', 0);
            setTimeout(function() {
                _chartControls.controlsCircles.move.setAttribute('r', _options.previewHeight * 0.75);
                _chartControls.controlsCircles.move.style.opacity = 1;
            });
            return false;
        };

        var leftUp = function() {
            removeEvent(window, 'mousemove', leftMove);
            removeEvent(window, 'mouseup', leftUp);

            setTimeout(function() {
                _chartControls.controlsCircles.left.setAttribute('r', 0);
                _chartControls.controlsCircles.left.style.opacity = 0;
            });
            upControl();
        };
        var leftMove = function(event) {
            preventDefault(event);

            var rangePercentsMove = (getClientX(event, downIdentifiers.left) - _startMovePosition['left']) / _canvasViewSizes.width;
            rangePercentsMove = Math.max(Math.min(rangePercentsMove, _previewDownPositions.minSize), _previewDownPositions.maxLeft);
            var start = _previewDownPositions.start + rangePercentsMove;

            _chartState.start = Math.min(start, _chartState.end - (invisibleButtonSize + _options.previewOutside.left) / _canvasViewSizes.width);
            _chartState.width = _chartState.end - _chartState.start;

            setLeftPosPreview();
            setPreviewSizes();
            drawBaseChart();
            return false;
        };
        var sizerLeftDown = function(event) {
            if (event.touches && event.touches.length) {
                downIdentifiers.left = event.targetTouches[0].identifier;
            }
            iniCommonDown(event, 'left');
            addEvent(window, 'mousemove', leftMove);
            addEvent(window, 'mouseup', leftUp);
            _chartControls.controlsCircles.left.setAttribute('r', 0);
            setTimeout(function() {
                _chartControls.controlsCircles.left.setAttribute('r', _options.previewHeight * 0.75);
                _chartControls.controlsCircles.left.style.opacity = 1;
            });
            return false;
        };


        var rightUp = function() {
            removeEvent(window, 'mousemove', rightMove);
            removeEvent(window, 'mouseup', rightUp);
            setTimeout(function() {
                _chartControls.controlsCircles.right.setAttribute('r', 0);
                _chartControls.controlsCircles.right.style.opacity = 0;
            });
            upControl();
        };
        var rightMove = function(event) {
            preventDefault(event);
            var rangePercentsMove = (getClientX(event, downIdentifiers.right) - _startMovePosition['right']) / _canvasViewSizes.width;
            rangePercentsMove = Math.max(Math.min(rangePercentsMove, _previewDownPositions.maxRight), -_previewDownPositions.minSize);

            var end = _previewDownPositions.end + rangePercentsMove;
            _chartState.end = Math.max(end, _chartState.start + (invisibleButtonSize + _options.previewOutside.left) / _canvasViewSizes.width);
            _chartState.width = _chartState.end - _chartState.start;
            setRightPosPreview();
            setPreviewSizes();
            drawBaseChart();
            return false;
        };
        var sizerRightDown = function(event) {
            if (event.touches && event.touches.length) {
                downIdentifiers.right = event.targetTouches[0].identifier;
            }
            iniCommonDown(event, 'right');
            addEvent(window, 'mousemove', rightMove);
            addEvent(window, 'mouseup', rightUp);

            _chartControls.controlsCircles.right.setAttribute('r', 0);
            setTimeout(function() {
                _chartControls.controlsCircles.right.setAttribute('r', _options.previewHeight * 0.75);
                _chartControls.controlsCircles.right.style.opacity = 1;
            });
            return false;
        };


        var movieAutoAnimation, iniDown;
        var shadowsUp = function() {
            iniDown = false;
            removeEvent(window, 'mouseup', shadowsUp);
            upControl();
        };
        var shadowsDown = function(event) {
            iniDown = true;
            preventDefault(event);
            removeAllHandlers();
            addEvent(window, 'mouseup', shadowsUp);
            var leftPosition = getClientX(event) - this.getBoundingClientRect()['x'];
            var absolutePosition = leftPosition / _canvasViewSizes.width;
            var centerWidth = _chartState.width / 2;
            if (absolutePosition < _chartState.end) {
                absolutePosition = Math.max(absolutePosition, centerWidth);
            } else {
                absolutePosition = Math.min(absolutePosition, 1 - centerWidth);
            }
            var animationRange = absolutePosition - (_chartState.start + centerWidth);
            var animationStep = animationRange / ANIMATION_FPS;

            var startEnd = absolutePosition - centerWidth;

            movieAutoAnimation = setInterval(function () {
                _chartState.start+= animationStep;
                _chartState.start = animationRange > 0 ?
                    Math.min(_chartState.start, startEnd) :
                    Math.max(_chartState.start, startEnd);
                _chartState.end = _chartState.start + _chartState.width;
                if (_chartState.start === startEnd) {
                    clearTimeout(movieAutoAnimation);
                    if (iniDown) {
                        moverDown(event);
                    }
                }
                setLeftPosPreview();
                setRightPosPreview();
                drawBaseChart();
            });
        };
        upControl();

    };


    var showPointValues = function() {
        _pointsGroup.style.opacity = 1;
    };
    var hidePointValues = function(fastHide) {
        if (fastHide) {
            var transition = _pointsGroup.style.transition;
            _pointsGroup.style.transition = '';
            _pointsGroup.style.opacity = 0;
            setTimeout(function() {
                _pointsGroup.style.transition = transition;
            });
        } else {
            _pointsGroup.style.opacity = 0;
        }
        pointsInfoTooltip.style.opacity = 0;
        setTimeout(function() {
            pointsInfoTooltip.style.disaply = 'none';
        }, 300);
        _chartState.selectedPointIndex = false;
    };

    var setTooltipPosition = function(index) {

        var xPosition = index * _chartState.onePointWidth - _chartState.linesLeftOffset;
        var floatIndexPosition = xPosition / _chartState.onePointWidth;
        var center = _chartState.endFloatPoint - _chartState.startFloatPoint;
        var position = floatIndexPosition - center / 2;
        var oneStepSize = pointsInfoTooltip.offsetWidth / center;

        pointsInfoTooltip.style.transform = 'translate(' + (-pointsInfoTooltip.offsetWidth / 2 + xPosition - oneStepSize * position)  + 'px, 0)';
    };


    var selectDataPoint = function(x) {
        var xPosition = x * _chartState.onePointWidth - _chartState.linesLeftOffset;
        _pointsGroup.style.opacity = 1;
        _chartState.selectedPointIndex = _chartState.startPoint + x;
        pointsInfoTooltip.style.display = 'block';
        setTimeout(function() {
            pointsInfoTooltip.style.opacity = 1;
        });
        _pointLine.setAttribute('x1', xPosition);
        _pointLine.setAttribute('x2', xPosition);
        _pointLine.setAttribute('y1', 0);
        _pointLine.setAttribute('y2', -_options.baseChartHeight);
        setTooltipPosition(x);
        setSelectedDatePoints(_chartData.xAxis.data[x + _chartState.startPoint]);
        _chartData.yAxis.forEach(function(chartDataParams) {
            chartDataParams.valueNode.valueNode.innerText = formatNumber(chartDataParams.visibleData[x]);
            chartDataParams.circleChart.setAttribute('cx', xPosition);
            chartDataParams.circleChart.setAttribute('cy', -chartDataParams.visibleData[x] *  _chartState.currentGridK);
        });
    };

    var iniBaseChartMove = function() {
        var activeArea;
        addEvent(_svgCanvas, 'mousemove', function(event) {
            var offsetPositions = this.getBoundingClientRect();
            var clientX = (event.clientX - offsetPositions['x']) - _options.padding.left;
            var clientY = (event.clientY - offsetPositions['y']) - _options.padding.top;

            var xSuccessful = (clientX > 0) && (clientX < _canvasViewSizes.width);
            var ySuccessful = (clientY > 0) && (clientY < _options.baseChartHeight);
            if (xSuccessful && ySuccessful) {
                if (!activeArea) {
                    showPointValues();
                }
                activeArea = true;
                selectDataPoint(Math.round((clientX + _chartState.linesLeftOffset) / _chartState.onePointWidth));
            } else {
                activeArea = false;
            }
        });
    };



    var previewAnimateInterval;

    var oneStepPreview = function(animatedCharts, kHeight, minValue) {
        var currkHeight = kHeight || _chartState.previewKHeight;
        var currMinValue = minValue || _chartState.maxMinValues.min;
        var onePointWidth = _canvasViewSizes.width / (_chartData.xAxis.data.length - 1);
        animatedCharts.forEach(function(chartItem) {
            var polyLinePoints = [];
            chartItem.data.forEach(function(chartDataPoint, chartDataIndex) {
                polyLinePoints.push(
                    (chartDataIndex * onePointWidth) + ',' +
                    (_options.previewHeight - ((chartDataPoint  - currMinValue) * currkHeight + _options.previewPadding)));
            });
            chartItem.polyline.setAttribute('points', polyLinePoints.join(' '));
        });
    };


    var drawPreviewChart = function(fast) {
        var maxMinValues = {
            max: null,
            min: null
        };
        _chartState.visibleCharts = _chartData.yAxis.filter(function(chart) {
            return !chart.hidden;
        });
        if (!_chartState.visibleCharts.length) {
            return;
        }
        _chartState.visibleCharts.forEach(function(item) {
            if (item.hidden) return;
            maxMinValues.min = (maxMinValues.min !== null) ? Math.min(maxMinValues.min, item.min) : item.min;
            maxMinValues.max = (maxMinValues.max !== null) ? Math.max(maxMinValues.max, item.max) : item.max;
        });

        var animatedCharts = _chartState.visibleCharts.filter(function(ch) {
            return ch.hidden === false;
        });
        var hiddenCharts = _chartData.yAxis.filter(function(chart) {
            return chart.hidden === null;
        });

        var hiddenProgressCharts = _chartData.yAxis.filter(function(chart) {
            return chart.hidden;
        });

        var kHeight = (_options.previewHeight - _options.previewPadding * 2) / (maxMinValues.max - maxMinValues.min);

        if (hiddenProgressCharts.length) {
            oneStepPreview(hiddenProgressCharts, _chartState.previewKHeight, _chartState.maxMinValues.min);
        }

        if (hiddenCharts.length) {
            oneStepPreview(hiddenCharts, kHeight, maxMinValues.min);
        }

        if (!_chartState.previewKHeight) {
            _chartState.previewKHeight = kHeight;
            _chartState.maxMinValues = maxMinValues;
            oneStepPreview(animatedCharts);
            return;
        }


        var kHeightRange = kHeight - _chartState.previewKHeight;
        var minValuesRange = maxMinValues.min - _chartState.maxMinValues.min;

        var oldMinValue = _chartState.maxMinValues.min;
        _chartState.maxMinValues = maxMinValues;

        if (kHeightRange || fast) {
            if (previewAnimateInterval) {
                _chartState.animatedPreview = false;
                clearInterval(previewAnimateInterval);
            }
            var step = kHeightRange / ANIMATION_FPS;
            var minValueStep = minValuesRange / ANIMATION_FPS;

            _chartState.animatedPreview = true;
            previewAnimateInterval = setInterval(function() {
                var newKH = _chartState.previewKHeight + step;
                oldMinValue+= minValueStep;

                _chartState.previewKHeight = (kHeightRange < 0) ?
                    Math.max(newKH, kHeight) : Math.min(newKH, kHeight);
                oneStepPreview(animatedCharts, false, oldMinValue);
                if (_chartState.previewKHeight === kHeight) {
                    clearInterval(previewAnimateInterval);
                    previewAnimateInterval = false;
                    _chartState.animatedPreview = false;
                }
            }, 10);
        }
    };

    generateChartLayouts();
    iniElementsSizes();
    applyColorTheme();


    var setOpacityLine = function(element, opacity, timeout, fast) {
        if (!fast) {
            setTimeout(function() {
                element.style.opacity = opacity;
            }, !isNaN(timeout) ? timeout : 20);
        } else {
            var oldTransition = element.style.transition;
            element.style.transition = undefined;
            element.style.opacity = opacity;
            element.style.transition = oldTransition;
        }
    };

    var createSVGDate = function(point, index) {
        var dateGroup = dateGroupEl.cloneNode(true);
        var svgRectDate = svgRectDateEl.cloneNode(false);
        var svgDate = svgDateEl.cloneNode(false);
        dateGroup.appendChild(svgDate);
        dateGroup.appendChild(svgRectDate);
        svgDate.textContent = point.label;
        if (!index) {
            svgDate.setAttribute('text-anchor', 'left');
        } else if (index === (_chartData.xAxis.data.length - 1)) {
            svgDate.setAttribute('transform', 'translate(' + (-_chartState.stepXAxis) + ', 0)');
            svgDate.setAttribute('text-anchor', 'end');
        }
        addEvent(dateGroup, 'mousedown', function() {
            selectDataPoint(index - _chartState.startPoint);
        });
        _datesGroup.appendChild(dateGroup);
        return dateGroup;
    };
    var removeSVGDate = function(point) {
        point.svg.style.opacity = 0;
        point.remover = setTimeout(function() {
            _chartState.visibleXAxisPoints = _chartState.visibleXAxisPoints.filter(function(visiblePoint) {
                if (visiblePoint === point) {
                    _datesGroup.removeChild(point.svg);
                    return false;
                } else {
                    return true;
                }
            });
        }, 500);
    };
    var redrawDates = function() {
        _chartState.xAxisVisible = _chartData.xAxis.data.slice(_chartState.startPoint, _chartState.endPoint);
        _chartState.xAxisStartPosition = (_chartState.startFloatPoint - (_chartState.startFloatPoint % _chartState.stepXAxis));
        _chartState.xAxisleftOffset = _chartState.startFloatPoint / _chartState.stepXAxis % 1;

        var kWidth = _chartState.xAxisInterval / _options.xAxisItemSize;
        var xAxisCount = _options.xAxisCount / kWidth + 1;

        var visibleDates = _chartState.visibleXAxisPoints.filter(function(dateModel) {
            var k = (dateModel.index - _chartState.xAxisStartPosition) / _chartState.stepXAxis;
            dateModel.svg.setAttribute('transform', 'translate(' + (k - _chartState.xAxisleftOffset) * _chartState.xAxisInterval + ', 0)');
            if ((dateModel.index % _chartState.stepXAxis) || (k < 0) || (k > xAxisCount)) {
                if (!dateModel.remover) {
                    removeSVGDate(dateModel);
                }
                return false;
            } else {
                if (dateModel.remover) {
                    clearTimeout(dateModel.remover);
                    dateModel.svg.style.opacity = 1;
                    dateModel.remover = false;
                }
                return true;
            }
        });

        for (var k = 0; k <= xAxisCount; k++) {
            var datePointPosition = k * _chartState.stepXAxis + _chartState.xAxisStartPosition;
            if (datePointPosition >= _chartData.xAxis.data.length) break;
            var visiblePoint = _chartData.xAxis.data[datePointPosition];
            var existsDateLabel = visibleDates.filter(function(exPoint) {
                return exPoint.point === visiblePoint;
            })[0];
            if (!existsDateLabel) {
                existsDateLabel = {
                    point: visiblePoint,
                    svg: createSVGDate(visiblePoint, datePointPosition),
                    index: datePointPosition
                };
                _chartState.visibleXAxisPoints.push(existsDateLabel);
                existsDateLabel.svg.setAttribute('transform', 'translate(' + (k - _chartState.xAxisleftOffset) * _chartState.xAxisInterval + ', 0)');
                setOpacityLine(existsDateLabel.svg, 1, 0, !((k > 0) && (k < (xAxisCount - 1))));
            }
        }
    };

    var removeSVGGridLine = function(line) {
        setOpacityLine(line.svg, 0);
        line.remover = setTimeout(function() {
            _chartState.gridLines = _chartState.gridLines.filter(function(visibleLine) {
                if (visibleLine === line) {
                    _gridsGroup.removeChild(line.svg);
                    return false;
                } else {
                    return true;
                }
            });
        }, 500);
    };
    var createSVGGridLine = function(gridLineValue) {
        var oneStepGroup = oneStepGroupEl.cloneNode(false);
        var oneLineText = oneLineTextEl.cloneNode(false);
        var shadowLineText = shadowLineTextEl.cloneNode(false);
        var oneLinePath = oneLinePathEl.cloneNode(false);

        oneLinePath.setAttribute('x2', _canvasViewSizes.width);
        oneStepGroup.appendChild(shadowLineText);
        oneStepGroup.appendChild(oneLineText);

        var strVal =  gridLineValue.toString();

        shadowLineText.textContent = oneLineText.textContent = strVal.length >= 7 ?
            (strVal / 1000000) + 'm' : strVal.length >= 4 ? (strVal / 1000) + 'k' : strVal;
        oneStepGroup.appendChild(oneLinePath);
        _gridsGroup.appendChild(oneStepGroup);
        return oneStepGroup;
    };
    var redrawGridLines = function() {
        var existsGridLines = _chartState.gridLines.filter(function(existsLine) {
            existsLine.svg.setAttribute('transform', 'translate(0, ' + (-existsLine.value * _chartState.currentGridK) + ')');
            if ((existsLine.value % _chartState.gridStep) || ((existsLine.value / _chartState.gridStep) % 1)) {
                if (!existsLine.remover) {
                    removeSVGGridLine(existsLine);
                }
                return false;
            } else {
                if (existsLine.remover) {
                    setOpacityLine(existsLine.svg, 1);
                    clearTimeout(existsLine.remover);
                    existsLine.remover = false;
                }
                return true;
            }
        });

        for (var k = 0; k <= _options.gridCount; k++) {
            var gridLineValue = k * _chartState.gridStep;
            var existsGridLine = existsGridLines.filter(function(existsLine) {
                return gridLineValue === existsLine.value;
            })[0];

            if (!existsGridLine) {
                existsGridLine = {
                    svg: createSVGGridLine(gridLineValue),
                    value: gridLineValue
                };
                existsGridLine.svg.setAttribute('transform', 'translate(0, ' + (-gridLineValue * _chartState.currentGridK) + ')');
                _chartState.gridLines.push(existsGridLine);
                setOpacityLine(existsGridLine.svg, 1);
            }
            existsGridLine.index = k;
        }

    };


    var drawBaseLines = function() {
        var xPosition = (_chartState.selectedPointIndex - _chartState.startPoint) * _chartState.onePointWidth - _chartState.linesLeftOffset;
        _chartData.yAxis.forEach(function(chartItem) {
            var polyLinePoints = [];
            if (_chartState.selectedPointIndex) {
                chartItem.circleChart.setAttribute('cy', -chartItem.data[_chartState.selectedPointIndex] * _chartState.currentGridK);
                chartItem.circleChart.setAttribute('cx', xPosition);
            }
            chartItem.visibleData.forEach(function(point, index) {
                var xVal = index * _chartState.onePointWidth - _chartState.linesLeftOffset;
                polyLinePoints.push(
                    xVal + ',' + (-point * _chartState.currentGridK)
                );
            });
            chartItem.basePolyline.setAttribute('d', 'M' + polyLinePoints.join(' L'));
        });
        redrawGridLines();
    };


    var animationInterval;

    var drawBaseChart = function() {
        _chartState.linesLeftOffset = _chartState.startFloatPoint % 1 * _chartState.onePointWidth;
        redrawDates();

        if (_chartState.selectedPointIndex) {
            var selectedXVal = (_chartState.selectedPointIndex - _chartState.startPoint) * _chartState.onePointWidth - _chartState.linesLeftOffset;
            setTooltipPosition(_chartState.selectedPointIndex - _chartState.startPoint);
            _pointLine.setAttribute('x2', selectedXVal);
            _pointLine.setAttribute('x1', selectedXVal);
        }

        if (!_chartState.visibleCharts.length) {
            return;
        }
        var allVisibleData = [];
        var visibleCharts = _chartData.yAxis.filter(function(chart) {
            chart.visibleData = chart.data.slice(_chartState.startPoint, _chartState.endPoint);
            return !chart.hidden;
        });
        visibleCharts.forEach(function(oneYItem) {
            allVisibleData = allVisibleData.concat(oneYItem.visibleData);
        });
        _chartState.maxVisible = Math.max.apply(null, allVisibleData);
        _chartState.minVisible = Math.min.apply(null, allVisibleData);

        var maxValue = _chartState.maxVisible + _chartState.maxMinValues.min * 0.75;

        var divNumber = Math.pow(10, Math.max((Math.round(maxValue)).toString().length - 2, 0));
        _chartState.gridStep = Math.round((maxValue / _options.gridCount) / divNumber) * divNumber;

        var absMaxValue = _chartState.gridStep * (_options.gridCount + 0.5);

        var kHeight = _options.baseChartHeight / absMaxValue;

        if (!_chartState.currentGridK) {
            _chartState.prevGridK = kHeight;
            _chartState.currentGridK = kHeight;
            drawBaseLines();
            return;
        }

        if (_chartState.prevGridK != kHeight) {
            animationInterval ? clearInterval(animationInterval) : false;
        } else {
            !animationInterval ? drawBaseLines() : false;
            return;
        }


        var kHeightRange = kHeight - _chartState.currentGridK;

        if (!kHeightRange) {
            !animationInterval ? drawBaseLines() : false;
            return;
        }
        _chartState.prevGridK = kHeight;
        var step = kHeightRange / ANIMATION_FPS;

        animationInterval = setInterval(function() {
            var newKH = _chartState.currentGridK + step;
            _chartState.currentGridK = (kHeightRange < 0) ?
                    Math.max(newKH, kHeight) : Math.min(newKH, kHeight);

            if (_chartState.currentGridK === kHeight) {
                clearInterval(animationInterval);
                animationInterval = false;
            }
            drawBaseLines();
        }, 10);
    };

    var _chartData = {
        yAxis: []
    };
    this.setData = function(data) {
        data.columns.forEach(function(column) {
            var columnName = column[0];
            var columnData = column.slice(1, column.length);
            switch (data.types[columnName]) {
                case 'x':
                    _chartData.xAxis = {
                        data: columnData.map(function(dataItem) {
                            var date = new Date(dataItem);
                            return {
                                value: dataItem,
                                label: MONTHS_NAMES[date.getMonth()] + ' ' + date.getDate(),
                                infoDate: DAYS_NAMES[date.getDay()] + ', ' + MONTHS_NAMES[date.getMonth()] + ' ' + date.getDate()
                            }
                        })
                    };
                    break;
                case 'line':
                    var polyLinePreviewChart = svgElement('polyline');

                    polyLinePreviewChart.setAttribute('fill-opacity', '0');
                    polyLinePreviewChart.setAttribute('stroke', data.colors[columnName]);
                    polyLinePreviewChart.setAttribute('stroke-width', '1.2');
                    polyLinePreviewChart.style.transition = 'stroke-opacity ' + _options.CSSduration;


                    var polyLineBaseChart = svgElement('path');
                    polyLineBaseChart.setAttribute('class', 'chart-base-view-line');
                    polyLineBaseChart.setAttribute('fill-opacity', '0');
                    polyLineBaseChart.setAttribute('stroke', data.colors[columnName]);
                    polyLineBaseChart.setAttribute('stroke-width', '2');
                    polyLineBaseChart.style.transition = 'stroke-opacity ' + _options.CSSduration;

                    var pointCircle = _pointCircle.cloneNode(false);
                    pointCircle.setAttribute('stroke', data.colors[columnName]);

                    var chartData = {
                        columnName: columnName,
                        name: data.names[columnName],
                        color: data.colors[columnName],
                        data: columnData,
                        min: Math.min.apply(null, columnData),
                        max: Math.max.apply(null, columnData),
                        polyline: polyLinePreviewChart,
                        basePolyline: polyLineBaseChart,
                        circleChart: pointCircle,
                        hidden: false,
                        valueNode: createChartInfoItem({
                            name: data.names[columnName],
                            color: data.colors[columnName],
                        })
                    };
                    _chartData.yAxis.push(chartData);
                    _chartsPreview.appendChild(polyLinePreviewChart);
                    _chartGroup.appendChild(polyLineBaseChart);
                    _pointsGroup.appendChild(pointCircle);

                    createButton(chartData);
                    break;
            }
        });

        polyFillAddEvent(pointsInfoTooltip, 'click', hidePointValues);

        setLeftPosPreview();
        setRightPosPreview();
        setPreviewSizes();
        addControlsHandlers();
        iniBaseChartMove();

        drawPreviewChart();


        var maxSizeInfo = 0;
        _chartData.yAxis.forEach(function(chart) {
            chart.valueNode.valueNode.innerText = formatNumber(_chartState.maxMinValues.max);
            maxSizeInfo = maxSizeInfo ? Math.max(chart.valueNode.baseNode.offsetWidth) : chart.valueNode.baseNode.offsetWidth;
            chart.valueNode.baseNode.style.width = maxSizeInfo +'px';
        });

        infoPointsTooltip.style.width = (maxSizeInfo + 1) * 2 + 'px';
        infoPointsTooltip.style.minWidth = '100px';
        pointsInfoTooltip.style.display = 'none';
        drawBaseChart();

    };

    var toggleChartVisibility = function(chart) {
        if (_chartState.animatedPreview) return;
        (chart.hidden !== false) ? showChart(chart) : hideChart(chart);
    };

    var showChart = function(showedChart) {
        showedChart.hidden = null;
        showedChart.valueNode.baseNode.style.display = 'block';
        showedChart.polyline.style['stroke-opacity'] = 1;
        showedChart.basePolyline.style['stroke-opacity'] = 1;
        showedChart.circleChart.style['stroke-opacity'] = 1;
        showedChart.circleChart.style['fill-opacity'] = 1;
        drawPreviewChart();
        drawBaseChart();
        showedChart.hidden = false;
    };

    var hideChart = function(hiddenChart) {
        hiddenChart.polyline.style['stroke-opacity'] = 0;
        hiddenChart.basePolyline.style['stroke-opacity'] = 0;
        hiddenChart.circleChart.style['stroke-opacity'] = 0;
        hiddenChart.circleChart.style['fill-opacity'] = 0;
        hiddenChart.hidden = true;
        hiddenChart.valueNode.baseNode.style.display = 'none';
        if ((_chartState.visibleCharts.length === 1) && (_chartState.visibleCharts[0] === hiddenChart)) {
            _chartState.visibleCharts = [];
            return;
        }
        drawPreviewChart();
        drawBaseChart();
    };

    polyFillAddEvent(window, 'resize', function() {
        var newSizes = {
            width: _element.offsetWidth,
            height: _element.offsetHeight
        };

        buttonsContainer.style.position = 'absolute';
        if (newSizes.width === _chartState.canvasSize.width) {
            buttonsContainer.style.position = '';
            return;
        }

        iniElementsSizes();
        setLeftPosPreview();
        setRightPosPreview();
        setPreviewSizes();

        _chartState.gridLines.forEach(function(line) {
            console.log(line);
            line.svg.querySelector('line').setAttribute('x2', _canvasViewSizes.width);
        });

        if (_chartState.visibleCharts.length) {
            drawPreviewChart(true);
            drawBaseChart();
        }

        buttonsContainer.style.position = '';
    });

}


Chart.prototype._defaultOptions = {
    startViewPosition: [0.2, 0.8],
    previewHeight: 45.6,
    xAxisHeight: 38.4,
    xAxisItemSize: 60,
    padding: {
        left: 0, //14.4,
        top: 14.4
    },
    gridItemHeight: 62,
    previewOutside: {
        left: 4.8,
        top: 1.2
    },
    minimumVisiblePoints: 4,
    JSduration: 180,
    CSSduration: '0.15s'
};

