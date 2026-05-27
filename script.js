"use strict";

const DATASETS = {
	power: {
		url: "data/power.csv",
		data: null,
		name: "Power Consumpton",
		unit: " GWh",
		color: "gold",
		isPerCapitaifible: true,
		perCapitaUnit: " kWh",
		perCapitaMultiplier: 1e6,
	},
	water: {
		url: "data/water.csv",
		data: null,
		name: "Freshwater Withdrawal",
		unit: " Billion m³",
		color: "darkturquoise",
		isPerCapitaifible: true,
		perCapitaUnit: " m³",
		perCapitaMultiplier: 1e9,
	},
	renewable: {
		url: "data/renewable.csv",
		data: null,
		name: "% of Power Coming From Renewable Sources",
		unit: "%",
		color: "green",
		isPerCapitaifible: false,
	},
	population: {
		url: "data/population.csv",
		data: null,
		name: "Total Population",
		unit: " People",
		color: "darkblue",
		isPerCapitaifible: false,
	},
	internet: {
		url: "data/internet.csv",
		data: null,
		name: "% of Population Using the Internet",
		unit: "%",
		color: "darkorchid",
		isPerCapitaifible: false,
	},
	gdp: {
		url: "data/gdp.csv",
		data: null,
		name: "GDP",
		unit: " USD",
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
			let total = null;
			let population = 0;
			for (const country of DATASETS[currentDatasetKey].data.keys()) {
				const value = DATASETS[currentDatasetKey].data.get(country)[year];
				if (value) {
					total = total || 0;
					total += value;
					population += DATASETS.population.data.get(country)[year];
				}
			}
			if (total === null) return null;

			const mul = DATASETS[currentDatasetKey].perCapitaMultiplier || 1;
			return total*mul/population;
		}
		let total = 0;
		let count = 0;
		for (const row of this.data.values()) {
			const value = row[year];
			if (!value) continue;
			total += value;
			count++;
		}
		if (count == 0) {
			return null;
		} else if (this.unit == "%") {
			return total/count;
		} else {
			return total;
		}
	},

	getTotalCountries(year, countries) {
		if (this.name.endsWith(PER_CAPITA_NAME_SUFFIX)) {
			let total = null;
			let population = 0;
			for (const country of DATASETS[currentDatasetKey].data.keys()) {
				if (!countries.find(d => d.id === country)) continue;
				const value = DATASETS[currentDatasetKey].data.get(country)[year];
				if (value) {
					total = total || 0;
					total += value;
					population += DATASETS.population.data.get(country)[year];
				}
			}
			if (total === null) return null;

			const mul = DATASETS[currentDatasetKey].perCapitaMultiplier || 1;
			return total*mul/population;
		}
		let total = 0;
		let count = 0;
		for (const country of this.data.keys()) {
			if (!countries.find(d => d.id === country)) continue;
			const value = this.data.get(country)[year];
			if (value === null || value === undefined) continue;
			total += value;
			count++;
		}
		if (count == 0) {
			return null;
		} else if (this.unit == "%") {
			return total/count;
		} else {
			return total;
		}
	},
}

const datasetSelect = d3.select("#dataset-select");
const yearSlider = d3.select("#year-slider");
const yearText = d3.select("#year-text");
const perCapitaToggle = d3.select("#per-capita-toggle");
const logScaleToggle = d3.select("#log-scale-toggle");

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
	logScaleToggle.attr("disabled", currentDataset.unit !== "%" ? null : "true");
	// window.sessionStorage.setItem("dataset-key", datasetKey);
	drawMap();
	drawSidebar();
});

yearSlider.on("input", () => {
	currentYear = yearSlider.property("value");
	yearText.property("value", currentYear);
	drawMap();
	drawSidebar();
});

yearText.on("input", () => {
	const text = yearText.property("value");
	const num = Number(text);
	if (YEARS.includes(num)) {
		yearSlider.property("value", num);
		currentYear = num;
	}
	drawMap();
	drawSidebar();
});

perCapitaToggle.on("change", () => {
	isPerCapita = perCapitaToggle.property("checked");
	drawMap();
	drawSidebar();
})

logScaleToggle.on("change", () => {
	useLogScale = logScaleToggle.property("checked");
	drawMap();
	drawSidebar();
})

const TOPO_URL = "europe-topo.json";
const YEARS = d3.range(Number(yearSlider.attr("min")), Number(yearSlider.attr("max"))+1);
const NO_DATA_COLOR = "#bbb";
const PER_CAPITA_SUFFIX = "PerCapita";
const PER_CAPITA_NAME_SUFFIX = " Per Capita";

let topo = null;
let currentDatasetKey = datasetSelect.property("value");
let currentDataset = DATASETS[currentDatasetKey];
let currentYear = yearSlider.property("value");
let isPerCapita = perCapitaToggle.property("checked");
let useLogScale = logScaleToggle.property("checked");
let selectedCountries = [];
let hoveredCountry = null;

yearText.property("value", currentYear);

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
			selectedCountries = [];
			drawSidebar();
		});

	const projection = d3.geoMercator()
		.fitSize([width, height], topo);
	const path = d3.geoPath().projection(projection);
	const colorScale = createColorScale(currentDataset, currentYear, useLogScale);

	const microstates = ["GI", "SM", "MT", "MC", "LI", "IM", "AD"];

	svg.selectAll(".country")
		.data(topo.features.filter(d => !microstates.includes(d.id)))
		.join("path")
		.attr("class", "country")
		.attr("id", d => d.id)
		.attr("d", path)
		.attr("fill", d => getCountryColor(currentDataset, d.id, colorScale, currentYear));

	// borders
	svg.selectAll(".border")
		.data(topo.features.filter(d => !microstates.includes(d.id)))
		.join("path")
		.attr("class", d => "border" + (selectedCountries.includes(d) ? " selected" : ""))
		.attr("id", d => d.id + "-border")
		.attr("d", path)
		.attr("fill", "transparent")
		.on("click", (_, d) => {
			const idx = selectedCountries.findIndex(c => c === d);
			if (idx >= 0) {
				selectedCountries.splice(idx, 1);
				d3.select("#" + d.id).classed("selected", false);
				d3.select("#" + d.id + "-border").classed("selected", false);
			} else {
				selectedCountries.push(d);
				d3.select("#" + d.id).classed("selected", true);
				d3.select("#" + d.id + "-border").classed("selected", true);
			}
			drawSidebar();
		})
		.on("mouseover", (_, d) => {
			hoveredCountry = d;
			drawSidebar();
		})
		.on("mouseout", () => {
			hoveredCountry = null;
			drawSidebar();
		})
		.append("title")
		.text(d => d.properties.name);

	// microstates
	svg.selectAll(".microstate")
		.data(topo.features.filter(d => microstates.includes(d.id)))
		.join("circle")
		.attr("class", "country microstate border")
		.attr("id", d => d.id)
		.attr("cx", d => projection(countryCenter(d.geometry))[0])
		.attr("cy", d => projection(countryCenter(d.geometry))[1])
		.attr("r", 6)
		.attr("fill", d => getCountryColor(currentDataset, d.id, colorScale, currentYear))
		.on("click", (_, d) => {
			const idx = selectedCountries.findIndex(c => c === d);
			if (idx >= 0) {
				selectedCountries.splice(idx, 1);
				d3.select("#" + d.id).classed("selected", false);
			} else {
				selectedCountries.push(d);
				d3.select("#" + d.id).classed("selected", true);
			}
			drawSidebar();
		})
		.on("mouseover", (_, d) => {
			hoveredCountry = d;
			drawSidebar();
		})
		.on("mouseout", () => {
			hoveredCountry = null;
			drawSidebar();
		})
		.append("title")
		.text(d => d.properties.name);
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

function countryCenter(geometry) {
	const points = geometry.coordinates;
	let minX, maxX, minY, maxY;
	if (geometry.type === "Polygon") {
		minX = maxX = points[0][0][0];
		minY = maxY = points[0][0][1];
		for (const point of points) {
			maxX = maxX < point[0] ? point[0] : maxX;
			minX = minX > point[0] ? point[0] : minX;
			maxY = maxY < point[1] ? point[1] : maxY;
			minY = minY > point[1] ? point[1] : minY;
		}
	} else {
;		minX = maxX = points[0][0][0][0];
		minY = maxY = points[0][0][0][1];
		for (const chunk of points) {
			for (const point of chunk) {
				maxX = maxX < point[0] ? point[0] : maxX;
				minX = minX > point[0] ? point[0] : minX;
				maxY = maxY < point[1] ? point[1] : maxY;
				minY = minY > point[1] ? point[1] : minY;
			}
		}
	}
	return [(minX+maxX) / 2, (minY+maxY) / 2]
}

const ZERO_COLOR = "#e0e0e0";
function createColorScale(dataset, year, log) {
	if (dataset.unit == "%") {
		return d3.scaleLinear()
			.domain([0, 100])
			.range([ZERO_COLOR, dataset.color]);
	}

	const values = dataset.getYearValues(year).filter(d => d !== null);
	const domain = d3.extent(values);
	const scale = log ? d3.scaleLog() : d3.scaleLinear();
	return scale
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
	switch (selectedCountries.length) {
		case 0:
			if (hoveredCountry) {
				name = hoveredCountry.properties.name;
				value = currentDataset.getValue(hoveredCountry.id, currentYear);
			} else {
				name = "Europe";
				value = currentDataset.getTotal(currentYear);
			}
			break;
		case 1:
			name = selectedCountries[0].properties.name;
			value = currentDataset.getValue(selectedCountries[0].id, currentYear);
			break;
		default:
			name = "Multiple countries";
			value = currentDataset.getTotalCountries(currentYear, selectedCountries);
			break;
	}

	d3.select("#sidebar-title").text(name);
	d3.select("#sidebar-measurement-title").text(`${currentDataset.name} (${currentYear})`);
	if (value) {
		d3.select("#sidebar-measurement-value").text(formatNumber(value) + currentDataset.unit);
	} else {
		d3.select("#sidebar-measurement-value").text("No data");
	}

	let countries;
	if (selectedCountries.length !== 0) {
		countries = selectedCountries;
	} else if (hoveredCountry !== null) {
		countries = [hoveredCountry];
	} else {
		countries = [];
	}
	drawLinechart(currentDataset, countries, currentYear, useLogScale);
}

function formatNumber(n) {
	let decimals = 2;

	if (n >= 1e4) decimals = 0;
	else if (n >= 1e3) decimals = 1;
	if (n == Math.round(n)) decimals = 0;
	const formatter = Intl.NumberFormat("en-US", { maximumFractionDigits: decimals, useGrouping: true });

	return formatter.format(n).replaceAll(",", " ");
}

const GRID_LINE_COLOR = "#9bb";
function drawLinechart(dataset, countries, year, log) {
	const svg = d3.select("#linechart");
	svg.selectAll("*").remove();

	const margin = { top: 30, right: 50, bottom: 20, left: 60 };
	const width = svg.attr("width") - margin.left - margin.right;
	const height = svg.attr("height") - margin.top - margin.bottom;

	let datas;
	switch (countries.length) {
		case 0:
			datas = [dataset.getTotals()];
			break;
		case 1:
			datas = [dataset.getCountryValues(countries[0].id)];
			break;
		default:
			datas = [];
			for (const c of countries) {
				datas.push(dataset.getCountryValues(c.id));
			}
			break;
	}

	let yDomain;
	if (dataset.unit == "%") {
		yDomain = [0, 100];
	} else {
		yDomain = calculateYDomain(datas, log);
	}

	const xScale = d3.scaleLinear()
		.domain(d3.extent(YEARS))
		.range([margin.left, width + margin.left])
		.nice();

	const yScale = (log && dataset.unit !== "%" ? d3.scaleLog() : d3.scaleLinear())
		.domain(yDomain)
		.range([height + margin.top, margin.top]);

	const line = d3.line()
		.x(d => xScale(d.year))
		.y(d => yScale(d.value));

	const nGridLines = dataset.unit === "%" ? 10 : 7;

	let i = 0;
	if (datas.filter(d => d !== null).length !== 0) {
		// Grid lines
		svg.append("g")
			.attr("stroke", GRID_LINE_COLOR)
			.selectAll("line")
			.data(yScale.ticks(nGridLines))
			.join("line")
			.attr("x1", margin.left)
			.attr("x2", margin.left + width)
			.attr("y1", d => yScale(d))
			.attr("y2", d => yScale(d));

		for (const data of datas) {
			// Year line
			svg.append("line")
				.attr("stroke", GRID_LINE_COLOR)
				.attr("x1", xScale(year))
				.attr("x2", xScale(year))
				.attr("y1", margin.top)
				.attr("y2", margin.top + height);

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

			const filteredYearData = yearData.filter(d => d.value !== null);

			// Data points
			const g = svg.append("g")
				.selectAll(".point")
				.data(filteredYearData)
				.join("g")
				.attr("class", "point");

			g.append("circle")
				.attr("fill", dataset.color)
				.attr("cx", d => xScale(d.year))
				.attr("cy", d => yScale(d.value))
				.attr("r", 3);

			g.append("circle")
				.attr("class", "aura")
				.attr("fill", dataset.color)
				.attr("fill-opacity", 0.3)
				.attr("stroke", dataset.color)
				.attr("stroke-opacity", 0.5)
				.attr("cx", d => xScale(d.year))
				.attr("cy", d => yScale(d.value))
				.attr("r", 6);

			const w = xScale(1) - xScale(0);
			g.append("rect")
				.attr("id", d => d.year)
				.attr("fill", "transparent")
				.attr("x", d => xScale(d.year) - w/2)
				.attr("y", d => yScale(d.value) - 20)
				.attr("width", w)
				.attr("height", 40)
				.on("click", (_, d) => {
					currentYear = d.year;
					yearSlider.property("value", currentYear);
					yearText.property("value", currentYear);
					drawMap();
					drawSidebar();
				})
				.append("title")
				.text(d => {
					if (countries.length > 1) {
						return countries[i].properties.name + ", " + d.year + ": " + formatNumber(d.value) + dataset.unit
					} else {
						return d.year + ": " + formatNumber(d.value) + dataset.unit
					}
				});

			if (datas.length > 1 && filteredYearData.length !== 0) {
				svg.append("text")
					.attr("text-anchor", "start")
					.attr("x", xScale(filteredYearData.at(-1).year))
					.attr("y", yScale(filteredYearData.at(-1).value))
					.attr("dx", ".5em")
					.attr("dy", ".5em")
					.text(countries[i].id);
			}
			i++;
		}
	} else {
		svg.append("text")
			.attr("text-anchor", "middle")
			.attr("x", margin.left + width/2)
			.attr("y", margin.top + height/2)
			.attr("dy", "0.5em")
			.text("No data");
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
		chunks.push(data.slice(start));
	}
	return chunks;
}

const MIN_Y_DOMAIN = 1.5
const Y_PADDING = 0.05;
const Y_PADDING_LOG = 1.2;
function calculateYDomain(data, log) {
	let extents = [];
	for (const d of data) {
		const extent = d3.extent(d);
		extents.push(extent[0]);
		extents.push(extent[1]);
	}
	let extent = d3.extent(extents);
	const lower = extent[0];
	const upper = extent[1];
	const middle = (lower+upper) / 2

	if (log) {
		extent[0] /= Y_PADDING_LOG;
		extent[1] *= Y_PADDING_LOG;

		if (lower > upper/MIN_Y_DOMAIN) {
			return [Math.max(1, lower/MIN_Y_DOMAIN), upper*MIN_Y_DOMAIN];
		}

		return [Math.max(1, extent[0]), extent[1]];
	} else {
		const y_padding = (upper - lower) * Y_PADDING;
		extent[0] -= y_padding;
		extent[1] += y_padding;

		if (lower > upper/MIN_Y_DOMAIN) {
			return [Math.max(0, middle - lower*MIN_Y_DOMAIN/2), middle + lower*MIN_Y_DOMAIN/2];
		}

		return [Math.max(0, extent[0]), extent[1]];
	}
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
