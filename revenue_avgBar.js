export function avgRevBar({
    data, className,
    margin = { top: 20, right: 40, bottom: 40, left: 120 },
    font_color = 'black', font_family = 'Arial', font_size = 12, font_weight = 'normal',
    tooltip_borderRad = 4, tooltip_fadeIn = 200, tooltip_fadeOut = 500, tooltip_opacity = 0.9
}) {
    d3.select(className).selectAll("*").remove();

    const hostColorMap = {
        "Professionals": '#fd8d3c',
        "Single Owners": '#74c476',
        "2-5 Units": '#6baed6',
    };

    const avgRevenueByHost = d3.rollups(
        data,
        v => d3.mean(v, d => d.revenue),
        d => d.host_type
    );

    avgRevenueByHost.sort((a, b) => b[1] - a[1]);

    const { width: chartWidth, height: chartHeight } = d3.select(className).node().getBoundingClientRect();

    const svg = d3.select(className)
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;

    // X Scale
    const x = d3.scaleLinear()
        .domain([0, d3.max(avgRevenueByHost, d => d[1])])
        .nice()
        .range([0, innerWidth]);

    // Y Scale
    const y = d3.scaleBand()
        .domain(avgRevenueByHost.map(d => d[0]))
        .range([0, innerHeight])
        .padding(0.2);

    // Tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "revenue-avgBar-tooltip")
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

    // Bars
    svg.selectAll("rect")
        .data(avgRevenueByHost)
        .enter()
        .append("rect")
        .attr("y", d => y(d[0]))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", 0) // start from 0 for animation
        .attr("fill", d => hostColorMap[d[0]] || "#888")
        .on("mouseover", function (event, d) {
            tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
            tooltip.html(`<strong>Host:</strong> ${d[0]}<br><strong>Avg. Revenue:</strong> $${d[1].toFixed(2)}`)
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
        .transition()
        .duration(500)
        .attr("width", d => x(d[1]));


    // X Axis
    svg.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("$,.0f")))
        .selectAll("text")
        .style("font-size", font_size);

    // X Axis Label
    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 35)
        .attr("text-anchor", "middle")
        .attr('fill', font_color)
        .attr('font-family', font_family)
        .attr('font-size', font_size)
        .attr('font-weight', font_weight)
        .text("Avg. Revenue");

    // Y Axis
    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-size", font_size);

    // Y Axis Label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -margin.left + 20)
        .attr("text-anchor", "middle")
        .attr('fill', font_color)
        .attr('font-family', font_family)
        .attr('font-size', font_size)
        .attr('font-weight', font_weight)
        .text("Host Type");
}
