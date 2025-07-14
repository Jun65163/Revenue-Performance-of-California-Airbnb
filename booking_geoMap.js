let selectedCircleId = null;
let currZoomScale = 1;

function getMonthOnly(dateStr, date_cache) {
    if (date_cache.has(dateStr)) { // Returns month if in cache ("2019-01-01" : 1)
        return date_cache.get(dateStr);
    }

    // Not in cache, convert date from str to date type and get month
    const date = new Date(`${dateStr}-01`);
    const month = date.toLocaleString('default', { month: 'short' });

    date_cache.set(dateStr, month); // Cache to str : month
    return month;
}

function resetCircleStyle(circles, dotOpacity) {
    selectedCircleId = null;
    circles
        .attr("fill", d => d.rev_growth > 0 ? "green" : "red")
        .attr("fill-opacity", dotOpacity);
}

export function bookingGeoMap({ data, className, monthSelected,
    city_padding = 100, city_colour = "#ADD8E6",
    font_color = 'black', font_family = 'Arial', font_size = 14, font_weight = 'normal',
    dotScale = 0.005, maxDotSize = 20, minDotSize = 2, dotOpacity = 0.5,
    anime_duration = 500,
    zoomShrinkRate = 0.8, maxZoom = 50,
    tooltip_borderRad = 4, tooltip_fadeIn = 200, tooltip_fadeOut = 500, tooltip_opacity = 0.9,
    map_bgColour = "#F0F0F0" }) {
    /// LOCAL DATA PREPROCESS ///
    // Convert the month to actual months only (Jan, Feb...)
    const date_cache = new Map(); // Done to reduce LCP (speed up chart load time)
    const chartData = data.map(d => ({
        ...d,
        month: getMonthOnly(d.month, date_cache)
    }));

    // Sort months
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Using this sort since Sep in Edge is "Sept" but "Sep" in Chrome
    chartData.sort((a, b) => {
        const aIndex = monthOrder.indexOf((a.month).slice(0, 3));
        const bIndex = monthOrder.indexOf((b.month).slice(0, 3));
        return aIndex - bIndex;
    });

    // Group data by unified_id (prevent curr listings revenue - another listing last month revenue)
    const groupById = {};
    chartData.forEach(d => {
        if (!groupById[d.unified_id]) {
            groupById[d.unified_id] = [];
        }
        groupById[d.unified_id].push(d);
    });

    // Calculate rev_growth within each group (prevent curr listings revenue - another listing last month revenue)
    const revenueGrowth = Object.values(groupById).flatMap(group => {
        return group.map((d, i) => {
            const prevRevenue = i === 0 ? 0 : group[i - 1].revenue;
            return {
                ...d,
                rev_growth: i === 0 ? 0 : d.revenue - prevRevenue
            };
        });
    });

    // Filter by selected month
    const revenueGrowthMonth = revenueGrowth.filter(d => d.month.slice(0, 3) === monthSelected);


    /// SETTINGS FOR DISPLAY ///
    // Select svg by class
    const svg = d3.select(className);

    // Get svg width and height
    const { width: svgWidth, height: svgHeight } = svg.node().getBoundingClientRect();
    svg.style("background-color", map_bgColour);


    /// GEOJSON SETUP ///
    // Get geojson cities
    const cityNamesSet = new Set(
        revenueGrowthMonth
            .map(d => d.city)
            .filter(name => name != null)
            .map(name => name.toLowerCase().trim().replace(/\s+/g, "-"))
    );
    const cityNames = Array.from(cityNamesSet);

    // Using promises so won't generate map without map data
    const citiesGeoJson = cityNames.map(cityName =>
        d3.json(`https://raw.githubusercontent.com/generalpiston/geojson-us-city-boundaries/master/cities/ca/${cityName}.json`)
            .catch(() => null)
    );

    Promise.all(citiesGeoJson).then(allGeoData => {
        const validGeoData = allGeoData.filter(d => d !== null); // Remove null in geojson
        const allFeatures = validGeoData.flatMap(d => d.features); // Combine all features into single arr

        // Create combined geojson collection
        const combinedGeoJSON = {
            type: "FeatureCollection",
            features: allFeatures
        };

        // Note: added city_padding to make the cities not overlap
        const projection = d3.geoMercator()
            .center(d3.geoCentroid(combinedGeoJSON))
            .fitSize([svgWidth - city_padding, svgHeight - city_padding], combinedGeoJSON)
            .translate([svgWidth / 2, svgHeight / 2]);

        const path = d3.geoPath().projection(projection);

        let g = svg.select("g.booking-map-layer");
        if (g.empty()) {
            g = svg.append("g").attr("class", "booking-map-layer");
        }

        // Draw map
        const cityPaths = g.selectAll("path.booking-map-city")
            .data(allFeatures, d => d.properties?.NAME);

        cityPaths.enter()
            .append("path")
            .attr("class", "booking-map-city")
            .merge(cityPaths)
            .attr("d", path)
            .attr("fill", city_colour)
            .attr("stroke", "#000")
            .attr("stroke-width", 0.5);

        cityPaths.exit().remove();

        // Create city labels
        const city_labels = g.selectAll("text.booking-map-city-label")
            .data(allFeatures, d => d.properties?.NAME)
            .join(
                enter => enter.append("text")
                    .attr("class", "booking-map-city-label")
                    .attr("dy", ".35em")
                    .attr("text-anchor", "middle")
                    .style("pointer-events", "none")
                    .style("font-family", font_family)
                    .style("font-weight", font_weight)
                    .style("fill", font_color)
                    .style("font-size", font_size)
                    .text(d => d.properties.NAME || "")
                    .attr("transform", d => `translate(${path.centroid(d)})`),

                update => update
                    .text(d => d.properties.NAME || "")
                    .attr("transform", d => `translate(${path.centroid(d)})`)
                    .style("font-family", font_family)
                    .style("font-weight", font_weight)
                    .style("fill", font_color)
                    .style("font-size", `${font_size / currZoomScale}px`),

                exit => exit.remove()
            );

        // Plot dots
        const circles = g.selectAll("circle")
            .data(
                // Make small dots overlap big dots
                revenueGrowthMonth.slice().sort((a, b) => Math.abs(b.rev_growth) - Math.abs(a.rev_growth)),
                d => d.unified_id
            )
            .join(
                enter => enter.append("circle")
                    .attr("cx", d => projection([d.longitude, d.latitude])[0])
                    .attr("cy", d => projection([d.longitude, d.latitude])[1])
                    .attr("data-base-radius", d => Math.max(Math.min(Math.abs(d.rev_growth) * dotScale, maxDotSize), minDotSize))
                    .attr("r", 0)
                    .attr("fill", d => d.rev_growth > 0 ? "green" : "red")
                    .attr("fill-opacity", dotOpacity)
                    .attr("stroke-width", 0)
                    .transition()
                    .duration(anime_duration)
                    .attr("r", d => {
                        const baseRadius = Math.max(Math.min(Math.abs(d.rev_growth) * dotScale, maxDotSize), minDotSize);
                        return baseRadius / Math.pow(currZoomScale, zoomShrinkRate);
                    }),

                update => update
                    .transition()
                    .duration(anime_duration)
                    .attr("cx", d => projection([d.longitude, d.latitude])[0])
                    .attr("cy", d => projection([d.longitude, d.latitude])[1])
                    .attr("data-base-radius", d => Math.max(Math.min(Math.abs(d.rev_growth) * dotScale, maxDotSize), minDotSize))
                    .attr("r", d => {
                        const baseRadius = Math.max(Math.min(Math.abs(d.rev_growth) * dotScale, maxDotSize), minDotSize);
                        return baseRadius / Math.pow(currZoomScale, zoomShrinkRate);
                    })
                    .attr("fill", d => d.rev_growth > 0 ? "green" : "red"),

                exit => exit
                    .transition()
                    .duration(anime_duration)
                    .attr("r", 0)
                    .remove()
            );


        // Allow zoom
        const zoom = d3.zoom()
            .scaleExtent([1, maxZoom])
            .on("zoom", (event) => {
                currZoomScale = event.transform.k;  // Update curr zoom scale

                g.attr("transform", event.transform);

                // Update font size
                city_labels.style("font-size", `${font_size / currZoomScale}px`);

                // Update dot size
                circles
                    .attr("r", function () {
                        const baseRadius = +this.getAttribute("data-base-radius");
                        return baseRadius / Math.pow(currZoomScale, zoomShrinkRate);
                    });
            });

        svg.call(zoom);

        /// TOOL TIP INTERACTION ///
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "booking-map-tooltip")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("padding", "8px")
            .style("border", "1px solid #ccc")
            .style("border-radius", `${tooltip_borderRad}px`)
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style('fill', font_color)
            .style('font-family', font_family)
            .style('font-size', font_size)
            .style('font-weight', font_weight);

        circles.on("mouseover", function (event, d) {
            tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
            tooltip.html(
                `<strong>Month:</strong> ${d.city}<br>
                <strong>Street Name:</strong> ${d.street_name}<br>
                <strong>ZIP Code:</strong> ${d.zipcode}<br>
                <br>
                <strong>Revenue Growth:</strong> ${d.rev_growth.toFixed(2)}<br>
                <strong>Host Type:</strong> ${d.host_type}<br>
                <br>
                <strong>Longitude:</strong> ${d.longitude}<br>
                <strong>Latitude:</strong> ${d.latitude}<br>
                `
            )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
            .on("mousemove", function (event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                tooltip.transition().duration(tooltip_fadeOut).style("opacity", 0);
            });

        /// HIGHLIGHT GROWTH/NO GROWTH ///
        // Handle dot click
        circles.on("click", function (event, d) {
            event.stopPropagation(); // Prevent SVG background click

            selectedCircleId = d.unified_id;
            const isRevGrowth = d.rev_growth > 0;

            circles
                .attr("fill", d => {
                    if ((d.rev_growth > 0) === isRevGrowth) { // Keep colour if same colour as clicked dot
                        return isRevGrowth ? "green" : "red";
                    } else { // Lose colour if diff colour as clicked dot
                        return "#b3b3b3";
                    }
                })
                .attr("fill-opacity", d => {
                    if ((d.rev_growth > 0) === isRevGrowth) { // Keep opacity if same colour as clicked dot
                        return dotOpacity;
                    } else { // Lose opacity if diff colour as clicked dot
                        return 0.3;
                    }
                })
        });

        // Reset dot colour when clicked out
        svg.on("click", () => {
            resetCircleStyle(circles, dotOpacity);
        });
    });
}