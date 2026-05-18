import sys

if len(sys.argv) < 3:
    print("Usage:")
    print(f"\tpython {sys.argv[0]} population.csv data.csv")
    exit(0)

pop_file = sys.argv[1]
data_file = sys.argv[2]

def floatOrNull(string):
    try:
        return float(string)
    except:
        return None

def parseCsv(string: str):
    [header, *lines] = string.splitlines();
    years = [int(y.strip("\"")) for y in header.split(",")[1:]];
    rows: dict[str, dict[int, float]] = {}
    for line in lines:
        [country, *values] = line.split(",");
        country = country.strip("\"")
        rows[country] = {y: floatOrNull(v.strip("\"")) for [y, v] in zip(years, values)};
    return rows;

def dePerCapitaify(data, populations):
    out: dict[str, dict[int, float]] = {}
    for country in data:
        out[country] = {}
        for year in data[country]:
            try:
                out[country][year] = data[country][year] * populations[country][year]
            except:
                out[country][year] = None
    return out;

with open(pop_file) as f:
    populations = parseCsv(f.read())

with open(data_file) as f:
    in_data = parseCsv(f.read())

out_data = dePerCapitaify(in_data, populations)

with open("de-percapita-ified-" + data_file, "w") as f:
    print("Country Code", end="", file=f)
    years: list[int] = []
    for year in out_data.values().__iter__().__next__():
        years.append(year)
        print(f",{year}", end="", file=f)
    print(file=f)
    for country in out_data:
        print(f"{country}", end="", file=f)
        for year in years:
            print(",", end="", file=f)
            value = out_data[country][year]
            if value != None:
                print(f"{int(value/1e6)}", end="", file=f)
            else:
                print("", end="", file=f)
        print(file=f)
