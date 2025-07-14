let prevHostType = null;

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

export function occupancyBubbleChart({
  data, className, monthSelected, selectedHostType,
  tick_fontSize = 12,
  font_color = 'black', font_family = 'Arial', font_size = 12, font_weight = 'normal',
  tooltip_borderRad = 4, tooltip_fadeIn = 200, tooltip_fadeOut = 500, tooltip_opacity = 0.9,
  margin = { top: 30, right: 60, bottom: 80, left: 60 }
}) {
  // Select SVG container
  let svg = d3.select(className);

  // Change axis when host type change
  if (prevHostType !== selectedHostType) {
    svg.selectAll(".x-axis, .y-axis").remove();
    prevHostType = selectedHostType;
  }

  const boundingBox = svg.node().getBoundingClientRect();
  const width = boundingBox.width - margin.left - margin.right;
  const height = boundingBox.height - margin.top - margin.bottom;

  // Remove existing tooltip to prevent glitches of it being there when mouse not hover
  svg.selectAll(".occupancy-bubble-tooltip").remove();

  // Select existing group if present
  let g = svg.select("g.chart-group");
  if (g.empty()) {
    g = svg.append("g").classed("chart-group", true)
      .attr("transform", `translate(${margin.left},${margin.top})`);
  }

  // Convert the month to actual months only (Jan, Feb...)
  const date_cache = new Map();
  const chartData = data.map(d => ({
    ...d,
    month: getMonthOnly(d.month, date_cache)
  }));

  const chartDataRollUpNested = d3.rollups(
    chartData,
    v => ({
      nightly_rate: d3.mean(v, d => d['nightly rate']),
      occupancy: d3.mean(v, d => d.occupancy),
      revenue: d3.sum(v, d => d.revenue)
    }),
    d => d.city,
    d => d.month
  );

  const chartDataRollUp = chartDataRollUpNested.flatMap(([city, monthValues]) =>
    monthValues.map(([month, values]) => ({ city, month, ...values }))
  );

  const cityData = chartDataRollUp.filter(d => d.month.slice(0, 3) === monthSelected);

  // Scales
  const x = d3.scaleLinear()
    .domain([0, d3.max(chartDataRollUp, d => d.nightly_rate) * 1.1])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(chartDataRollUp, d => d.occupancy) * 1.1])
    .range([height, 0]);

  const r = d3.scaleSqrt()
    .domain([0, d3.max(chartDataRollUp, d => d.revenue)])
    .range([5, 40]);

  const city_color = d3.scaleOrdinal(d3.schemeObservable10);

  // Tooltip
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "occupancy-bubble-tooltip")
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

  // Axes
  // Create axes groups if not exist
  let xAxis = g.select(".x-axis");
  if (xAxis.empty()) {
    xAxis = g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`);
  }

  let yAxis = g.select(".y-axis");
  if (yAxis.empty()) {
    yAxis = g.append("g")
      .attr("class", "y-axis");
  }

  // Initial axis draw with scales
  xAxis.call(d3.axisBottom(x));
  yAxis.call(d3.axisLeft(y));

  xAxis.transition().duration(500).call(d3.axisBottom(x));
  yAxis.transition().duration(500).call(d3.axisLeft(y));

  // Then style only the tick labels:
  xAxis.selectAll("text")
    .style("font-size", tick_fontSize)
    .style("fill", font_color)
    .style("font-family", font_family)
    .style("font-weight", font_weight);

  yAxis.selectAll("text")
    .style("font-size", tick_fontSize)
    .style("fill", font_color)
    .style("font-family", font_family)
    .style("font-weight", font_weight);


  if (g.select(".x-axis-label").empty()) {
    g.append("text")
      .attr("class", "x-axis-label")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .attr("fill", font_color)
      .attr("font-family", font_family)
      .attr("font-size", font_size)
      .attr("font-weight", font_weight)
      .text("Avg. Nightly Rate");
  }

  if (g.select(".y-axis-label").empty()) {
    g.append("text")
      .attr("class", "y-axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -height / 2)
      .attr("y", -15)
      .attr("dy", "-2.5em")
      .attr("fill", font_color)
      .attr("font-family", font_family)
      .attr("font-size", font_size)
      .attr("font-weight", font_weight)
      .text("Avg. Occupancy Rate");
  }

  // Bubbles
  const circles = g.selectAll("circle")
    .data(cityData, d => d.city);

  circles.join(
    enter => enter.append("circle")
      .attr("cx", d => x(d.nightly_rate))
      .attr("cy", d => y(d.occupancy))
      .attr("r", 0)
      .attr("fill", d => city_color(d.city))
      .attr("opacity", 0.7)
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
        tooltip.html(
          `<strong>City:</strong> ${d.city}<br/>
           <strong>Nightly Rate:</strong> \$${d.nightly_rate.toFixed(2)}<br/>
           <strong>Occupancy Rate:</strong> ${d.occupancy.toFixed(2)}%<br/>
           <strong>Total Revenue:</strong> \$${d.revenue.toLocaleString()}`
        )
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(tooltip_fadeOut).style("opacity", 0);
      })
      .call(enter => enter.transition().duration(500)
        .attr("r", d => r(d.revenue))
      ),

    update => update
      .call(update => update
        .on("mouseover", (event, d) => {
          tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
          tooltip.html(
            `<strong>City:</strong> ${d.city}<br/>
           <strong>Nightly Rate:</strong> \$${d.nightly_rate.toFixed(2)}<br/>
           <strong>Occupancy Rate:</strong> ${d.occupancy.toFixed(2)}%<br/>
           <strong>Total Revenue:</strong> \$${d.revenue.toLocaleString()}`
          )
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", event => {
          tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
          tooltip.transition().duration(tooltip_fadeOut).style("opacity", 0);
        })
        .call(enter => enter.transition().duration(500)
          .attr("r", d => r(d.revenue))
        )
        .transition().duration(500)
        .attr("cx", d => x(d.nightly_rate))
        .attr("cy", d => y(d.occupancy))
        .attr("r", d => r(d.revenue))
      ),

    exit => exit
      .call(exit => exit.transition().duration(500)
        .attr("r", 0)
        .remove()
      )
  );

  // Legend
  const legend = g.selectAll(".occupancy-bubble-legend")
    .data(cityData.map(d => d.city));

  // Remove old legend items
  legend.exit().remove();

  const legendEnter = legend.enter().append("g")
    .attr("class", "occupancy-bubble-legend");

  legendEnter.append("rect")
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", d => city_color(d));

  legendEnter.append("text")
    .attr("x", 20)
    .attr("y", 7.5)
    .attr("dy", "0.35em")
    .attr("fill", font_color)
    .attr("font-family", font_family)
    .attr("font-size", font_size)
    .attr("font-weight", font_weight)
    .text(d => d + "   ");

  g.selectAll(".occupancy-bubble-legend")
    .attr("transform", (d, i) => `translate(${i * 110}, ${height + 55})`);
}
