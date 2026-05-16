const DATASETS = {
	power: {
		url: "data_power.csv",
		data: null,
		name: "Power Consumpton Per Capita",
		unit: "kWh per capita",
		color: "gold",
	},
	renewable: {
		url: "data_renewable.csv",
		data: null,
		name: "% of Power Coming From Renewable Sources",
		unit: "%",
		color: "green",
	},
	population: {
		url: "data_population.csv",
		data: null,
		name: "Total Population",
		unit: "People",
		color: "darkblue",
	},
};

const datasetSelect = d3.select("#dataset-select");
const yearSlider = d3.select("#year-slider");

const datasetKeys = Object.keys(DATASETS);
for (const k of datasetKeys) {
	const dataset = DATASETS[k];
	datasetSelect.append("option")
		.attr("value", k)
		.text(dataset.name);

	dataset.loadData = async function() {
		if (this.data !== null) return;

		const response = await fetch(this.url);
		if (!response.ok) {
			console.error(`Fetch error: ${response.status} ${response.statusText}`);
		}
		const text = await response.text();
		this.data = d3.csvParse(text, d => {
			const row = { country: d["Country Code"] };
			YEARS.map(year => {
				row[year] = d[year] ? parseFloat(d[year]) : null;
			});
			return row;
		});
	};

	dataset.getCountryValues = function(country) {
		const data = this.data;
		const row = data.find(d => d.country === country);
		if (!row) return null;
		const values = YEARS.map(year => row[year]);
		return values;
	}

	dataset.getYearValues = function(year) {
		const data = this.data;
		const values = data.map(d => d[year]);
		return values;
	}

	dataset.getValue = function(country, year) {
		const data = this.data;
		const row = data.find(d => d.country === country);
		if (!row) return null;
		return row[year];
	}

	dataset.getTotals = function() {
		return YEARS.map(year => this.getTotal(year));
	}

	dataset.getTotal = function(year) {
		const data = this.data;
		let total = 0;
		let count = 0;
		for (row of data) {
			const value = row[year];
			if (!value) continue;
			total += value;
			count++;
		}
		if (this.unit == "%") {
			return total/count;
		} else {
			return total;
		}
	}
}

// if (window.sessionStorage.getItem("dataset-key")) {
// 	datasetSelect.property("value", window.sessionStorage.getItem("dataset-key"));
// }

datasetSelect.on("change", () => {
	const datasetKey = datasetSelect.property("value");
	currentDataset = DATASETS[datasetKey];
	// window.sessionStorage.setItem("dataset-key", datasetKey);
	drawMap();
	drawSidebar();
});

yearSlider.on("input", () => {
	currentYear = yearSlider.property("value");
	d3.select("#year-display").text(currentYear);
	drawMap();
	drawSidebar();
});

const TOPO_URL = "europe-topo.json";
const YEARS = d3.range(Number(yearSlider.attr("min")), Number(yearSlider.attr("max"))+1);
const NO_DATA_COLOR = "#ccc";

let topo = null;
let currentDataset = DATASETS[datasetSelect.property("value")];
let currentYear = yearSlider.property("value");
let selectedCountry = null;

d3.select("#year-display").text(currentYear);

drawMap();
drawSidebar();

async function loadMap() {
	if (topo !== null) return;

	const response = await fetch(TOPO_URL);
	if (!response.ok) {
		console.error(`Fetch error (${TOPO_URL}): ${response.status} ${response.statusText}`);
	}
	const json = await response.json();
	topo = json;
}

// MAP FUNCTIONS
// =============
async function drawMap() {
	await loadMap();
	await currentDataset.loadData();

	const svg = d3.select("#map");
	svg.selectAll("*").remove();

	const objKey = Object.keys(topo.objects)[0];
	const objs = topojson.feature(topo, topo.objects[objKey]);

	const width = svg.attr("width");
	const height = svg.attr("height");

	svg.append("rect")
		.attr("width", width)
		.attr("height", height)
		.attr("opacity", 0)
		.on("click", _ => {
			selectedCountry = null;
			drawSidebar();
		});

	const projection = d3.geoMercator()
		.fitSize([width, height], objs);
	const path = d3.geoPath().projection(projection);
	const colorScale = createColorScale(currentDataset, currentYear);

	svg.selectAll(".country")
		.data(objs.features)
		.join("path")
		.attr("class", "country")
		.attr("id", d => d.id)
		.attr("d", path)
		.attr("fill", d => getCountryColor(currentDataset, d.id, colorScale, currentYear))
		.on("click", (_, d) => {
			selectedCountry = d;
			drawSidebar();
		});
}

function createColorScale(dataset, year) {
	if (dataset.unit == "%") {
		return d3.scaleLinear()
			.domain([0, 100])
			.range(["#f0f0f0", dataset.color]);
	}

	const values = dataset.getYearValues(year).filter(d => d !== null);
	const domain = d3.extent(values);
	return d3.scaleLinear()
		.domain(domain)
		.range(["#f0f0f0", dataset.color]);
}

function getCountryColor(dataset, country, colorScale, year) {
	const value = dataset.getValue(country, year);
	if (!value) return NO_DATA_COLOR;
	return colorScale(value);
}

// SIDABAR FUNCTIONS
// =================
async function drawSidebar() {
	await currentDataset.loadData();

	let value;
	let name;
	if (selectedCountry) {
		name = selectedCountry.properties.name;
		value = currentDataset.getValue(selectedCountry.id, currentYear);
	} else {
		name = "Europe";
		value = currentDataset.getTotal(currentYear);
	}

	d3.select("#sidebar-title").text(name);
	d3.select("#sidebar-measurement-title").text(currentDataset.name);
	if (value) {
		let decimals = 2;

		if (value >= 1e4) decimals = 0;
		else if (value >= 1e3) decimals = 1;
		if (value == Math.round(value)) decimals = 0;
		const formatter = Intl.NumberFormat("en-US", { maximumFractionDigits: decimals, useGrouping: true });

		const str = formatter.format(value).replaceAll(",", " ");

		d3.select("#sidebar-measurement-value").text(str);
		d3.select("#sidebar-measurement-unit").text(currentDataset.unit);
	} else {
		d3.select("#sidebar-measurement-value").text("No data");
		d3.select("#sidebar-measurement-unit").text("");
	}

	drawLinechart(currentDataset, selectedCountry);
}

const GRID_LINE_COLOR = "#eee";
function drawLinechart(dataset, country) {
	const svg = d3.select("#linechart");
	svg.selectAll("*").remove();

	const margin = { top: 10, right: 10, bottom: 30, left: 50 };
	const width = svg.attr("width") - margin.left - margin.right;
	const height = svg.attr("height") - margin.top - margin.bottom;

	let data;
	if (country) {
		data = dataset.getCountryValues(country.id);
	} else {
		data = dataset.getTotals();
	}

	let yDomain;
	if (dataset.unit == "%") {
		yDomain = [0, 100];
	} else {
		yDomain = calculateYDomain(data);
	}

	const xScale = d3.scaleLinear()
		.domain(d3.extent(YEARS))
		.range([margin.left, width - margin.right]);

	const yScale = d3.scaleLinear()
		.domain(yDomain)
		.range([height - margin.bottom, margin.top]);

	const line = d3.line()
		.x(d => xScale(d.year))
		.y(d => yScale(d.value));

	svg.append("g")
		.attr("stroke", GRID_LINE_COLOR)
		.call(g => g.append("g")
			.selectAll("line")
			.data(yScale.ticks())
			.join("line")
			.attr("x1", margin.left)
			.attr("x2", width - margin.right)
			.attr("y1", d => yScale(d))
			.attr("y2", d => yScale(d))
		);

	svg.append("path")
		.datum(YEARS.map(year => ({ value: data[year-YEARS[0]], year: year })).filter(d => d.value !== null))
		.attr("fill", "none")
		.attr("stroke", dataset.color)
		.attr("stroke-width", 2)
		.attr("d", line);

	svg.append("g")
		.attr("transform", `translate(0, ${height - margin.bottom})`)
		.call(d3.axisBottom(xScale)
			.tickFormat(d3.format("d"))
			.ticks(5)
		);

	svg.append("g")
		.attr("transform", `translate(${margin.left}, 0)`)
		.call(d3.axisLeft(yScale)
			.tickFormat(formatTickNumber)
			.ticks(5)
		);
}

const MIN_Y_DOMAIN = 1.5
const Y_PADDING = 0.05;
function calculateYDomain(data) {
	let extent = d3.extent(data);
	const lower = extent[0];
	const upper = extent[1];
	const middle = (lower+upper) / 2

	const y_padding = (upper - lower) * Y_PADDING;
	extent[0] -= y_padding;
	extent[1] += y_padding;

	if (lower > upper/MIN_Y_DOMAIN) {
		return [middle - lower*MIN_Y_DOMAIN/2, middle + lower*MIN_Y_DOMAIN/2];
	}

	return extent;
}

function formatTickNumber(n) {
	if (n >= 1e12) {
		return "too big!";
	} else if (n >= 1e9) {
		return (n/1e9).toPrecision(3) + "B";
	} else if (n >= 1e6) {
		return (n/1e6).toPrecision(3) + "M";
	} else if (n >= 1e3) {
		return (n/1e3).toPrecision(3) + "k";
	}
	return String(n);
}
