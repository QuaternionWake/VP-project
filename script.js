"use strict";

const DATASETS = {
	power: {
		url: "data_power.csv",
		data: null,
		name: "Power Consumpton",
		unit: "GWh",
		color: "gold",
		isPerCapitaifible: true,
		perCapitaUnit: "kWh",
		perCapitaMultiplier: 1e6,
	},
	water: {
		url: "data_water.csv",
		data: null,
		name: "Freshwater Withdrawal",
		unit: "Billion m³",
		color: "darkturquoise",
		isPerCapitaifible: true,
		perCapitaUnit: "m³",
		perCapitaMultiplier: 1e9,
	},
	renewable: {
		url: "data_renewable.csv",
		data: null,
		name: "% of Power Coming From Renewable Sources",
		unit: "%",
		color: "green",
		isPerCapitaifible: false,
	},
	population: {
		url: "data_population.csv",
		data: null,
		name: "Total Population",
		unit: "People",
		color: "darkblue",
		isPerCapitaifible: false,
	},
	internet: {
		url: "data_internet.csv",
		data: null,
		name: "% of Population Using the Internet",
		unit: "%",
		color: "darkorchid",
		isPerCapitaifible: false,
	},
	gdp: {
		url: "data_gdp.csv",
		data: null,
		name: "GDP",
		unit: "USD",
		color: "darkolivegreen",
		isPerCapitaifible: true,
	},
};

const funs = {
	async loadData() {
		if (this.data !== null) return;

		const response = await fetch(this.url);
		if (!response.ok) {
			console.error(`Fetch error: ${response.status} ${response.statusText}`);
		}
		const text = await response.text();
		const data = d3.csvParse(text, d => {
			const data = {};
			YEARS.map(year => {
				data[year] = d[year] ? parseFloat(d[year]) : null;
			});
			return { country: d["Country Code"], data: data };
		});
		delete data.columns;
		this.data = new Map;
		const keys = Object.keys(data);
		for (const key of keys) {
			const d = data[key];
			this.data.set(d.country, d.data);
		}
	},

	getCountryValues(country) {
		const values = this.data.get(country);
		if (!values) return null;
		return YEARS.map(year => values[year]);
	},

	getYearValues(year) {
		const iter = this.data.values().map(d => d[year]);
		return Array.from(iter);
	},

	getValue(country, year) {
		const values = this.data.get(country);
		if (!values) return null;
		return values[year];
	},

	getTotals() {
		return YEARS.map(year => this.getTotal(year));
	},

	getTotal(year) {
		if (this.name.endsWith(PER_CAPITA_NAME_SUFFIX)) {
			const total = DATASETS[currentDatasetKey].getTotal(year);
			const pop = DATASETS.population.getTotal(year);
			const mul = DATASETS[currentDatasetKey].perCapitaMultiplier || 1;
			return total*mul/pop;
		}
		let total = 0;
		let count = 0;
		for (const row of this.data.values()) {
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
	},
}

const datasetSelect = d3.select("#dataset-select");
const yearSlider = d3.select("#year-slider");
const perCapitaToggle = d3.select("#per-capita-toggle");

for (const key of Object.keys(DATASETS)) {
	const dataset = DATASETS[key];
	datasetSelect.append("option")
		.attr("value", key)
		.text(dataset.name);

	for (const key of Object.keys(funs)) {
		dataset[key] = funs[key];
	}
}

// if (window.sessionStorage.getItem("dataset-key")) {
// 	datasetSelect.property("value", window.sessionStorage.getItem("dataset-key"));
// }

datasetSelect.on("change", () => {
	currentDatasetKey = datasetSelect.property("value");
	currentDataset = DATASETS[currentDatasetKey];
	perCapitaToggle.attr("disabled", currentDataset.isPerCapitaifible ? null : "true");
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

perCapitaToggle.on("change", () => {
	isPerCapita = perCapitaToggle.property("checked");
	drawMap();
	drawSidebar();
})

const TOPO_URL = "europe-topo.json";
const YEARS = d3.range(Number(yearSlider.attr("min")), Number(yearSlider.attr("max"))+1);
const NO_DATA_COLOR = "#ccc";
const PER_CAPITA_SUFFIX = "PerCapita";
const PER_CAPITA_NAME_SUFFIX = " Per Capita";

let topo = null;
let currentDatasetKey = datasetSelect.property("value");
let currentDataset = DATASETS[currentDatasetKey];
let currentYear = yearSlider.property("value");
let isPerCapita = perCapitaToggle.property("checked");
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
	await DATASETS.population.loadData();

	const svg = d3.select("#map");
	svg.selectAll("*").remove();

	const padding = 20;
	const width = Number(svg.attr("width"));
	const height = Number(svg.attr("height"));
	const viewBox = {
		x: -padding,
		y: -padding,
		width: width+2*padding,
		height: height+2*padding,
	};

	if (isPerCapita && currentDataset.isPerCapitaifible) {
		perCapitaify(currentDatasetKey, DATASETS.population.data)
		currentDataset = DATASETS[currentDatasetKey + PER_CAPITA_SUFFIX];
	} else {
		currentDataset = DATASETS[currentDatasetKey];
	}

	svg.attr("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
	svg.append("rect")
		.attr("x", viewBox.x)
		.attr("y", viewBox.y)
		.attr("width", viewBox.width)
		.attr("height", viewBox.height)
		.attr("opacity", 0)
		.on("click", _ => {
			d3.selectAll(".selected").classed("selected", false);
			selectedCountry = null;
			drawSidebar();
		});

	const projection = d3.geoMercator()
		.fitSize([width, height], topo);
	const path = d3.geoPath().projection(projection);
	const colorScale = createColorScale(currentDataset, currentYear);

	svg.selectAll(".country")
		.data(topo.features)
		.join("path")
		.attr("class", "country")
		.attr("id", d => d.id)
		.attr("d", path)
		.attr("fill", d => getCountryColor(currentDataset, d.id, colorScale, currentYear))
		.on("click", (_, d) => {
			d3.selectAll(".selected").classed("selected", false);
			selectedCountry = d;
			d3.select("#" + selectedCountry.id).classed("selected", true);
			d3.select("#" + selectedCountry.id + "-border").classed("selected", true);
			drawSidebar();
		})
		.append("title")
		.text(d => d.properties.name);

	// borders
	svg.selectAll(".border")
		.data(topo.features)
		.join("path")
		.attr("class", "border")
		.attr("id", d => d.id + "-border")
		.attr("d", path)
		.attr("fill", "none");
}

function perCapitaify(datasetKey, populatons) {
	const perCapitaKey = datasetKey + PER_CAPITA_SUFFIX;
	if (DATASETS[perCapitaKey] !== undefined) return;

	const dataset = DATASETS[datasetKey];
	const perCapita = {
		url: null,
		data: new Map(),
		name: dataset.name + PER_CAPITA_NAME_SUFFIX,
		unit: (dataset.perCapitaUnit || dataset.unit) + PER_CAPITA_NAME_SUFFIX,
		color: dataset.color,
		isPerCapitaifible: true,
	};

	const multiplier = dataset.perCapitaMultiplier || 1;

	for (const country of dataset.data.keys()) {
		perCapita.data.set(country, {});
		for (const year of Object.keys(dataset.data.get(country))) {
			if (dataset.data.get(country)[year] === null || populatons.get(country)[year] === null) {
				perCapita.data.get(country)[year] = null;
			} else {
				perCapita.data.get(country)[year] = dataset.data.get(country)[year] / populatons.get(country)[year] * multiplier;
			}
		}
	}

	for (const key of Object.keys(funs)) {
		perCapita[key] = funs[key];
	}

	DATASETS[perCapitaKey] = perCapita;
}

const ZERO_COLOR = "#e0e0e0";
function createColorScale(dataset, year) {
	if (dataset.unit == "%") {
		return d3.scaleLinear()
			.domain([0, 100])
			.range([ZERO_COLOR, dataset.color]);
	}

	const values = dataset.getYearValues(year).filter(d => d !== null);
	const domain = d3.extent(values);
	return d3.scaleLinear()
		.domain(domain)
		.range([ZERO_COLOR, dataset.color]);
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
	await DATASETS.population.loadData();

	if (isPerCapita && currentDataset.isPerCapitaifible) {
		perCapitaify(currentDatasetKey, DATASETS.population.data)
		currentDataset = DATASETS[currentDatasetKey + PER_CAPITA_SUFFIX];
	} else {
		currentDataset = DATASETS[currentDatasetKey];
	}

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

const GRID_LINE_COLOR = "#9bb";
function drawLinechart(dataset, country) {
	const svg = d3.select("#linechart");
	svg.selectAll("*").remove();

	const margin = { top: 30, right: 50, bottom: 20, left: 60 };
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
		.range([margin.left, width + margin.left])
		.nice();

	const yScale = d3.scaleLinear()
		.domain(yDomain)
		.range([height + margin.top, margin.top]);

	const line = d3.line()
		.x(d => xScale(d.year))
		.y(d => yScale(d.value));

	const nGridLines = dataset.unit === "%" ? 10 : 7;

	// Grid lines
	svg.append("g")
		.attr("stroke", GRID_LINE_COLOR)
		.call(g => g.append("g")
			.selectAll("line")
			.data(yScale.ticks(nGridLines))
			.join("line")
			.attr("x1", margin.left)
			.attr("x2", width + margin.left)
			.attr("y1", d => yScale(d))
			.attr("y2", d => yScale(d))
		);

	// The titular line
	const yearData = YEARS.map(year => ({ value: data[year-YEARS[0]], year: year }));
	for (const chunk of splitData(yearData)) {
		svg.append("path")
			.datum(chunk)
			.attr("fill", "none")
			.attr("stroke", dataset.color)
			.attr("stroke-width", 2)
			.attr("d", line);
	}

	// X axis
	svg.append("g")
		.attr("transform", `translate(0, ${height + margin.top})`)
		.call(d3.axisBottom(xScale).ticks(5, "d"))
		.append("text")
		.attr("class", "axis-label")
		.attr("text-anchor", "start")
		.attr("x", width + margin.left)
		.attr("dx", "1em")
		.attr("y", "0.5em")
		.attr("font-size", "1.4em")
		.attr("font-weight", "bold")
		.attr("fill", "currentColor")
		.text("Year");

	// Y axis
	svg.append("g")
		.attr("transform", `translate(${margin.left}, 0)`)
		.call(d3.axisLeft(yScale).tickFormat(formatTickNumber).ticks(nGridLines))
		.append("text")
		.attr("class", "axis-label")
		.attr("text-anchor", "middle")
		.attr("y", margin.top)
		.attr("dy", "-.7em")
		.attr("font-size", "1.4em")
		.attr("font-weight", "bold")
		.attr("fill", "currentColor")
		.text(dataset.unit);
}

function splitData(data) {
	let chunks = [];
	let start = 0;
	let canInsert = false;
	for (let i=0; i<data.length; i++) {
		if (data[i].value === null) {
			if (canInsert) {
				chunks.push(data.slice(start, i));
				canInsert = false;
			}
		} else {
			if (canInsert === false) {
				start = i;
				canInsert = true;
			}
		}
	}
	if (canInsert) {
		chunks.push(data.slice(start, -1));
	}
	return chunks;
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
	if (n >= 1e21) {
		return "too big!";
	} else if (n >= 1e18) {
		return (n/1e18).toPrecision(3) + "Qi";
	} else if (n >= 1e15) {
		return (n/1e15).toPrecision(3) + "Qa";
	} else if (n >= 1e12) {
		return (n/1e12).toPrecision(3) + "T";
	} else if (n >= 1e9) {
		return (n/1e9).toPrecision(3) + "B";
	} else if (n >= 1e6) {
		return (n/1e6).toPrecision(3) + "M";
	} else if (n >= 1e3) {
		return (n/1e3).toPrecision(3) + "k";
	}
	return String(n);
}
