export function revenueTreemap({ rawData, className,
    font_color = 'black', font_family = 'Arial', font_size = 14, font_weight = 'normal',
    tooltip_borderRad = 4, tooltip_fadeIn = 200, tooltip_fadeOut = 500, tooltip_opacity = 0.9,
}) {
    // Prevent glitch where tooltip cant disappear when changing host type but mouse hover on treemap
    d3.select("body").selectAll(".revenue-treemap-tooltip").remove();

    // Step 1: Aggregate revenue per zipcode
    const revenueData = d3.rollups(
        rawData,
        v => d3.sum(v, d => d.revenue),
        d => d.city
    ).map(([city, revenue]) => ({ city, revenue }));

    // Step 2: Create a hierarchy root node
    const root = d3.hierarchy({ children: revenueData })
        .sum(d => d.revenue);

    // Step 3: Setup dimensions
    // Get svg width and height
    const { width: chartWidth, height: chartHeight } = d3.select(className).node().getBoundingClientRect();

    const svg = d3.select(className)
        .attr("width", chartWidth)
        .attr("height", chartHeight);

    svg.selectAll("*").remove(); // Clear prev treemap

    // Step 4: Create treemap layout
    d3.treemap()
        .size([chartWidth, chartHeight])
        .padding(1)
        (root);

    // Step 5: Color scale
    const color = d3.scaleSequential()
        .domain([0, d3.max(revenueData, d => d.revenue)])
        .interpolator(d3.interpolateBlues);

    // Step 6: Draw rectangles
    const nodes = svg.selectAll("g")
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    const treeArea = nodes.append("rect")
        .attr("width", 0)
        .attr("height", 0)
        .attr("fill", d => color(d.data.revenue));

    // Step 7: Add labels
    nodes.append("text")
        .attr("x", 4)
        .attr("y", 18)
        .attr("fill", d => {
            const rgb = d3.color(color(d.data.revenue));
            const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
            return brightness < 140 ? "white" : "black";
        })
        .style("font-size", font_size)
        .style('font-family', font_family)
        .style('font-size', font_size)
        .style('font-weight', font_weight)
        .style("pointer-events", "none")
        .each(function (d) {
            const text = d3.select(this);
            const words = d.data.city.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.5; // em
            const x = +text.attr("x");
            const y = +text.attr("y");
            const rectWidth = d.x1 - d.x0 - 8;

            text.text(null); // clear OG text

            // Wrap city
            let tspan = text.append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", "0em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > rectWidth) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan")
                        .attr("x", x)
                        .attr("y", y)
                        .attr("dy", `${++lineNumber * lineHeight}em`)
                        .text(word);
                }
            }

            // Append revenue on a new line below city
            text.append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", `${(lineNumber + 1) * lineHeight}em`)  // 1 line below last city tspan
                .text(`$${(d.data.revenue / 1000).toFixed(1)}k`);
        });


    /// TOOL TIP INTERACTION ///
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "revenue-treemap-tooltip")
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

    treeArea.transition()
        .duration(500)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

    treeArea.on("mouseover", function (event, d) {
        tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
        tooltip.html(`<strong>City:</strong> ${d.data.city}<br><strong>Revenue:</strong> ${d.data.revenue.toFixed(2)}`)
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
}