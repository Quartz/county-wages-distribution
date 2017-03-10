// NPM modules
var d3 = require('d3');
var request = require('d3-request');

// Local modules
var features = require('./detectFeatures')();
var fm = require('./fm');
var utils = require('./utils');

// Globals
var DEFAULT_WIDTH = 940;
var MOBILE_BREAKPOINT = 600;

var graphicData = null;
var isMobile = false;

/**
 * Initialize the graphic.
 *
 * Fetch data, format data, cache HTML references, etc.
 */
function init() {
	request.csv('data/pct_change_distribution.csv', function(error, data) {
		graphicData = formatData(data);

		render();
		$(window).resize(utils.throttle(onResize, 250));
	});
}

/**
 * Format data or generate any derived variables.
 */
function formatData(data) {
	data.forEach(function(d) {
		d['count'] = +d['count'];
	});

	return data;
}

/**
 * Invoke on resize. By default simply rerenders the graphic.
 */
function onResize() {
	render();
}

/**
 * Figure out the current frame size and render the graphic.
 */
function render() {
	var width = $('#interactive-content').width();

	if (width <= MOBILE_BREAKPOINT) {
		isMobile = true;
	} else {
		isMobile = false;
	}

	renderGraphic({
		container: '#graphic',
		width: width,
		data: graphicData
	});

	// Inform parent frame of new height
	fm.resize()
}

/*
 * Render the graphic.
 */
function renderGraphic(config) {
	/*
	 * Setup chart container.
	 */
	var labelColumn = 'pct_change';
	var valueColumn = 'count';

	var aspectWidth = isMobile ? 4 : 16;
	var aspectHeight = isMobile ? 3 : 9;
	var valueGap = 6;

	var margins = {
		top: 10,
		right: 15,
		bottom: 30,
		left: 40
	};

	var ticksY = 4;
	var roundTicksFactor = 50;

	// Calculate actual chart dimensions
	var chartWidth = config['width'] - margins['left'] - margins['right'];
	var chartHeight = Math.ceil((config['width'] * aspectHeight) / aspectWidth) - margins['top'] - margins['bottom'];

	// Clear existing graphic (for redraw)
	var containerElement = d3.select(config['container']);
	containerElement.html('');

	/*
	 * Create the root SVG element.
	 */
	var chartWrapper = containerElement.append('div')
		.attr('class', 'graphic-wrapper');

	var chartElement = chartWrapper.append('svg')
		.attr('width', chartWidth + margins['left'] + margins['right'])
		.attr('height', chartHeight + margins['top'] + margins['bottom'])
		.append('g')
		.attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

	/*
	 * Create D3 scale objects.
	 */
	var ticks = config['data'].map(function (d) {
		return d[labelColumn];
	});

	var xScale = d3.scale.ordinal()
		.rangeRoundBands([0, chartWidth], .1)
		.domain(ticks);

	var min = d3.min(config['data'], function(d) {
		return Math.floor(d[valueColumn] / roundTicksFactor) * roundTicksFactor;
	});

	if (min > 0) {
		min = 0;
	}

	var max = d3.max(config['data'], function(d) {
		return Math.ceil(d[valueColumn] / roundTicksFactor) * roundTicksFactor;
	});

	var yScale = d3.scale.linear()
		.domain([min, max])
		.range([chartHeight, 0]);

	/*
	 * Create D3 axes.
	 */
	var xAxis = d3.svg.axis()
		.scale(xScale)
		.orient('bottom')
		.tickFormat(function(d, i) {
			var mod = 2;

			if (i % mod == 1) {
				return d + '%';
			}

			return '';
		});

	var yAxis = d3.svg.axis()
		.scale(yScale)
		.orient('left')
		.ticks(ticksY)
		.tickFormat(function(d) {
			return d;
		});

	/*
	 * Render axes to chart.
	 */
	var xTicks = chartElement.append('g')
		.attr('class', 'x axis')
		.attr('transform', makeTranslate((xScale.rangeBand() / 2) * 1.1, chartHeight))
		.call(xAxis);

	chartElement.append('g')
		.attr('class', 'y axis')
		.call(yAxis)

	/*
	 * Render grid to chart.
	 */
	var yAxisGrid = function() {
		return yAxis;
	};

	var yGrid = chartElement.append('g')
		.attr('class', 'y grid')
		.call(yAxisGrid()
			.tickSize(-chartWidth, 0)
			.tickFormat('')
		);

	yGrid.append('line')
		.attr('class', 'zero')
		.attr('transform', makeTranslate((xScale.rangeBand()) * 1.05, -xAxis.tickSize()))
		.attr('x1', xScale('0'))
		.attr('y1', 0)
		.attr('x2', xScale('0'))
		.attr('y2', chartHeight + xAxis.tickSize() * 2);

	xTicks.selectAll('g.tick')
		.filter(function(d) {
			return d == '0';
		})
		.classed('zero', true)

	var t = xTicks.append('g')
		.attr('class', 'tick')
		.attr('transform', makeTranslate(xScale('-15') - (xScale.rangeBand() / 2) * 1.15, 0));

	t.append('line')
		.attr('y2', 6)

	t.append('text')
		.attr('dy', '.71em')
		.attr('y', '9')
		.style('text-anchor', 'middle')
		.text('-20%');

	/*
	 * Render bars to chart.
	 */
	chartElement.append('g')
		.attr('class', 'bars')
		.selectAll('rect')
		.data(config['data'])
		.enter()
		.append('rect')
			.attr('x', function(d) {
				return xScale(d[labelColumn]);
			})
			.attr('y', function(d) {
				if (d[valueColumn] < 0) {
					return yScale(0);
				}

				return yScale(d[valueColumn]);
			})
			.attr('width', xScale.rangeBand())
			.attr('height', function(d) {
				if (d[valueColumn] < 0) {
					return yScale(d[valueColumn]) - yScale(0);
				}

				return yScale(0) - yScale(d[valueColumn]);
			})
			.attr('class', function(d) {
				return 'bar bar-' + d[labelColumn];
			});

	/*
	 * Render 0 value line.
	 */
	if (min < 0) {
		chartElement.append('line')
			.attr('class', 'zero-line')
			.attr('x1', 0)
			.attr('x2', chartWidth)
			.attr('y1', yScale(0))
			.attr('y2', yScale(0));
	}
}

/*
 * Create a SVG tansform for a given translation.
 */
var makeTranslate = function(x, y) {
    var transform = d3.transform();

    transform.translate[0] = x;
    transform.translate[1] = y;

    return transform.toString();
}

// Bind on-load handler
$(document).ready(function() {
	init();
});
