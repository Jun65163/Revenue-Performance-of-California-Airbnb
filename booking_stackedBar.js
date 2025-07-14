export function bookingStackedBar({ data, className,
    tick_fontSize = 12,
    margin = { top: 20, right: 20, bottom: 80, left: 100 },
    font_color = 'black', font_family = 'Arial', font_size = 12, font_weight = 'normal',
    tooltip_borderRad = 4, tooltip_fadeIn = 200, tooltip_fadeOut = 500, tooltip_opacity = 0.9 }
) {
    // Setup svg
    let container = d3.select(className);
    let svg = container.select("svg");

    // Get svg width and height
    const { width: width, height: height } = d3.select(className).node().getBoundingClientRect();

    if (svg.empty()) {
        svg = container.append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        svg.append("g").attr("class", "booking-stackedBar-chart-group")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        svg.append("g").attr("class", "booking-stackedBar-x-axis");
        svg.append("g").attr("class", "booking-stackedBar-y-axis");
        svg.append("g").attr("class", "booking-stackedBar-legend-group");
    }

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const chartGroup = svg.select(".booking-stackedBar-chart-group");

    // 2nd filter out missing data
    const filteredData = data.filter((d) => d.city && d.host_type);

    // 3rd count occurances per zip code and host type
    const groupedData = d3.rollups(
        filteredData,
        v => v.length,
        d => d.city,
        d => d.host_type
    );

    // 4th format data for stacked bar chart
    const stackedData = groupedData.map(([zip, hostTypeCounts]) => {
        const entry = { city: zip };
        hostTypeCounts.forEach(([host_type, count]) => {
            entry[host_type] = count;
        });
        return entry;
    });

    const keys = Array.from(new Set(filteredData.map(d => d.host_type)));

    // Sort by total bookings desc
    const sortedStackedData = stackedData.slice().sort((a, b) => {
        const totalA = d3.sum(keys, k => a[k] || 0);
        const totalB = d3.sum(keys, k => b[k] || 0);
        return totalB - totalA;
    });

    const finalStackedData = d3.stack().keys(keys)(sortedStackedData);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedStackedData, d => d3.sum(keys, k => d[k] || 0))])
        .range([0, chartWidth])
        .nice();

    const yScale = d3.scaleBand()
        .domain(sortedStackedData.map(d => d.city))
        .range([0, chartHeight])
        .padding(0.2);


    const colorMap = {
        '2-5 Units': '#6baed6',
        'Professionals': '#fd8d3c',
        'Single Owners': '#74c476'
    };
    const colorScale = d3.scaleOrdinal()
        .domain(keys)
        .range(keys.map(k => colorMap[k] || '#ccc'));


    svg.select(".booking-stackedBar-x-axis")
        .attr("transform", `translate(${margin.left}, ${margin.top + chartHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("font-size", tick_fontSize)
        .style("fill", font_color)
        .style("font-family", font_family)
        .style("font-weight", font_weight);

    svg.select(".booking-stackedBar-y-axis")
        .attr("transform", `translate(${margin.left}, ${margin.top})`)
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-size", tick_fontSize)
        .style("fill", font_color)
        .style("font-family", font_family)
        .style("font-weight", font_weight);

    // Setup stacked bar layers
    const layers = chartGroup.selectAll("g.layer")
        .data(finalStackedData, d => d.key);

    const layersEnter = layers.enter().append("g")
        .attr("class", "layer")
        .attr("fill", d => colorScale(d.key));

    layersEnter.merge(layers)
        .attr("fill", d => colorScale(d.key));

    layers.exit().remove();



    // Draw bars with animation
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "booking-stackedBar-tooltip")
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

    const rects = layersEnter.merge(layers)
        .selectAll("rect")
        .data(d => d, d => d.data.city);

    rects.enter()
        .append("rect")
        .attr("y", d => yScale(d.data.city))
        .attr("x", d => xScale(d[0]))
        .attr("height", yScale.bandwidth())
        .attr("width", 0)
        .merge(rects)

        // Tooltip
        .on("mouseover", function (event, d) {
            tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
            tooltip.html(`
        <strong>City:</strong> ${d.data.city}<br>
        <strong>Host Type:</strong> ${d3.select(this.parentNode).datum().key}<br>
        <strong>Bookings:</strong> ${d[1] - d[0]}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition().duration(tooltip_fadeOut).style("opacity", 0);
        })

        // Animation
        .transition()
        .duration(500)
        .attr("y", d => yScale(d.data.city))
        .attr("x", d => xScale(d[0]))
        .attr("height", yScale.bandwidth())
        .attr("width", d => xScale(d[1]) - xScale(d[0]));

    rects.exit()
        .transition()
        .duration(500)
        .attr("width", 0)
        .remove();

    // Legend
    const legendGroup = svg.select(".booking-stackedBar-legend-group")
        .attr("transform", `translate(${margin.left}, ${margin.top + chartHeight + 40})`);

    const legend = legendGroup.selectAll(".booking-stackedBar-legend")
        .data(keys, d => d);

    const legendEnter = legend.enter()
        .append("g")
        .attr("class", "booking-stackedBar-legend")
        .attr("transform", (d, i) => `translate(${i * 100}, ${height + 60})`);

    legendEnter.append("rect")
        .attr("y", 15)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", d => colorScale(d));

    legendEnter.append("text")
        .attr("x", 20)
        .attr("y", 22.5)
        .attr("dy", "0.35em")
        .attr("fill", font_color)
        .attr("font-family", font_family)
        .attr("font-size", font_size)
        .attr("font-weight", font_weight)
        .text(d => d);

    legendEnter.merge(legend)
        .attr("transform", (d, i) => `translate(${i * 100}, 0)`);

    legend.exit().remove();

    // X Axis Label (append only once and update if func run again)
    if (svg.select(".booking-stackedBar-x-axis-label").empty()) {
        svg.append("text")
            .attr("class", "booking-stackedBar-x-axis-label")
            .attr("x", margin.left + chartWidth / 2)
            .attr("y", margin.top + chartHeight + 40)
            .attr("text-anchor", "middle")
            .attr('fill', font_color)
            .attr('font-family', font_family)
            .attr('font-size', font_size)
            .attr('font-weight', font_weight)
            .text("Number of Bookings");
    }

    // Y Axis Label (append only once and update if func run again)
    if (svg.select(".booking-stackedBar-y-axis-label").empty()) {
        svg.append("text")
            .attr("class", "booking-stackedBar-y-axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -margin.top - chartHeight / 2)
            .attr("y", 10)
            .attr("text-anchor", "middle")
            .attr('fill', font_color)
            .attr('font-family', font_family)
            .attr('font-size', font_size)
            .attr('font-weight', font_weight)
            .text("City");
    }
}
