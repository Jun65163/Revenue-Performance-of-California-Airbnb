export function revenueVsOccupancyScatter({
    data, svgClassName, containerClassName,
    tick_fontSize = 12,
    margin = { top: 20, right: 20, bottom:50, left: 70 },
    font_color = 'black', font_family = 'Arial', font_size = 12, font_weight = 'normal',
    tooltip_borderRad = 4, tooltip_fadeIn = 200, tooltip_fadeOut = 500, tooltip_opacity = 0.9
}) {

    // Get svg width and height
    const { width: chartWidth, height: chartHeight } = d3.select(svgClassName).node().getBoundingClientRect();

    // Clean up any existing canvas
    const container = d3.select(containerClassName);
    container.selectAll('canvas').remove();

    // Add canvas
    const canvas = container.append('canvas')
        .attr('width', chartWidth)
        .attr('height', chartHeight)
        .style('position', 'relative')
        .node();

    const ctx = canvas.getContext('2d');

    // Sort revenue
    const sortedRevenue = data
        .map(d => d.revenue)
        .filter(r => r !== undefined && r > 0)
        .sort((a, b) => a - b);

    // Calculate q1, q3, iqr
    const q1 = d3.quantile(sortedRevenue, 0.25);
    const q3 = d3.quantile(sortedRevenue, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Filter data (remove revenue outliers too)
    const filteredData = data.filter(d =>
        d.revenue !== undefined && d.revenue > 0 &&
        d.occupancy !== undefined && d.occupancy > 0 &&
        d.revenue >= lowerBound && d.revenue <= upperBound
    );

    const hostTypes = Array.from(new Set(filteredData.map(d => d.host_type)))
        .sort((a, b) => a.localeCompare(b));
    const colorMap = {
        '2-5 Units': '#6baed6',
        'Professionals': '#fd8d3c',
        'Single Owners': '#74c476'
    };
    const colorScale = d3.scaleOrdinal()
        .domain(hostTypes)
        .range(hostTypes.map(k => colorMap[k] || '#ccc'));

    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;

    // Define scales
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => d.revenue)])
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => d.occupancy)])
        .range([innerHeight, 0]);

    // Draw axes inside a translated group
    const svg = d3.select(svgClassName)
        .attr('width', chartWidth)
        .attr('height', chartHeight)
        .style('position', 'absolute')
        .style('top', '0px')
        .style('left', '0px');

    svg.selectAll('*').remove();

    const mainGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    mainGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("$.2s")))
        .selectAll("text")
        .style("font-size", tick_fontSize)
        .style("fill", font_color)
        .style("font-family", font_family)
        .style("font-weight", font_weight);

    mainGroup.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d3.format(".0%")))
        .selectAll("text")
        .style("font-size", tick_fontSize)
        .style("fill", font_color)
        .style("font-family", font_family)
        .style("font-weight", font_weight);

    // X-axis label
    svg.append("text")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", chartHeight - margin.bottom / 2 + 15)
        .attr("text-anchor", "middle")
        .attr("fill", font_color)
        .attr("font-family", font_family)
        .attr("font-size", font_size)
        .attr("font-weight", font_weight)
        .text("Revenue");

    // Y-axis label
    svg.append("text")
        .attr("transform", `rotate(-90)`)
        .attr("x", - (margin.top + innerHeight / 2))
        .attr("y", margin.left / 3)
        .attr("text-anchor", "middle")
        .attr("fill", font_color)
        .attr("font-family", font_family)
        .attr("font-size", font_size)
        .attr("font-weight", font_weight)
        .text("Occupancy Rate");

    // Draw dots on canvas
    const circle_radius = 4;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(margin.left, margin.top);

    filteredData.forEach(d => {
        ctx.beginPath();
        ctx.arc(xScale(d.revenue), yScale(d.occupancy), circle_radius, 0, 2 * Math.PI);
        ctx.fillStyle = colorScale(d.host_type);
        ctx.globalAlpha = 0.5;
        ctx.fill();
    });

    ctx.restore();

    // Calcualte trend line
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    filteredData.forEach(d => {
        const x = d.revenue;
        const y = d.occupancy;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    });
    const N = filteredData.length;
    const slope = (N * sumXY - sumX * sumY) / (N * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / N;

    // Start and end of line
    const xStart = 0;
    const yStart = slope * xStart + intercept;
    const xEnd = d3.max(filteredData, d => d.revenue);
    const yEnd = slope * xEnd + intercept;

    // Draw line
    ctx.save();
    ctx.translate(margin.left, margin.top);

    ctx.beginPath();
    ctx.moveTo(xScale(xStart), yScale(yStart));
    ctx.lineTo(xScale(xEnd), yScale(yEnd));
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Legend
    const legendGroup = svg.append("g")
        .attr("class", "rev-vsOccupancy-legend-group")
        .attr("transform", `translate(${margin.left}, ${margin.top + innerHeight + 40})`);

    const legend = legendGroup.selectAll(".rev-vsOccupancy-legend")
        .data(hostTypes, d => d);

    const legendEnter = legend.enter()
        .append("g")
        .attr("class", "rev-vsOccupancy-legend")
        .attr("transform", (d, i) => `translate(${i * 100},0)`);

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

    // Tooltip setup
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "rev-vsOccupancy-tooltip")
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

    // Tooltip interaction
    canvas.addEventListener('mousemove', event => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left - margin.left;
        const mouseY = event.clientY - rect.top - margin.top;

        const closestDot = filteredData.find(d => {
            const cx = xScale(d.revenue);
            const cy = yScale(d.occupancy);
            const dx = cx - mouseX;
            const dy = cy - mouseY;
            const hitRadius = circle_radius + 2;
            return dx * dx + dy * dy <= hitRadius * hitRadius;
        });

        if (closestDot) {
            tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
            tooltip.html(`<strong>Host:</strong> ${closestDot.host_type}<br>
                <strong>Revenue:</strong> $${closestDot.revenue.toFixed(2)}<br>
                <strong>Occupancy:</strong> ${(closestDot.occupancy * 100).toFixed(1)}%`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        } else {
            tooltip.transition().duration(tooltip_fadeOut).style("opacity", 0);
        }
    });

    canvas.addEventListener('mouseout', () => {
        tooltip.transition().duration(tooltip_fadeOut).style("opacity", 0);
    });
}
