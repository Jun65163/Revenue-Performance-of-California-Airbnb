function parseMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1);
}

function highlightCity(svg, cityData, selectedCity) {
  // Gray out all lines except the selected one
  svg.selectAll(".line")
    .attr("stroke-opacity", d => d.city === selectedCity ? 1 : 0.2)
    .attr("stroke-width", d => d.city === selectedCity ? 5 : 3);

  // Gray out all circles except selected city
  cityData.forEach(city => {
    svg.selectAll(`.occupancy-line-dot-${city.city.replace(/\s+/g, '-')}`)
      .attr("fill-opacity", city.city === selectedCity ? 1 : 0.2)
      .attr("r", city.city === selectedCity ? 5 : 3);
  });
}

function resetHighlight(svg, cityData, city_color) {
  // Reset lines to normal
  svg.selectAll(".line")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 4)
    .attr("stroke", d => city_color(d.city));

  // Reset circles to normal
  cityData.forEach(city => {
    svg.selectAll(`.occupancy-line-dot-${city.city.replace(/\s+/g, '-')}`)
      .attr("fill-opacity", 1)
      .attr("r", 4)
      .attr("fill", city_color(city.city));
  });
}

export function occupancyLineChart({ data, className,
  tick_fontSize = 12,
  margin = { top: 30, right: 20, bottom: 80, left: 60 },
  font_color = 'black', font_family = 'Arial', font_size = 12, font_weight = 'normal',
  tooltip_borderRad = 4, tooltip_fadeIn = 200, tooltip_fadeOut = 500, tooltip_opacity = 0.9
}) {
  // Get svg width and height
  const boundingBox = d3.select(className).node().getBoundingClientRect();
  const width = boundingBox.width - margin.left - margin.right;
  const height = boundingBox.height - margin.top - margin.bottom;

  const svgContainer = d3.select(className)
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  svgContainer.selectAll("*").remove();

  const svg = svgContainer.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create scales
  const x = d3.scaleTime().range([20, width - 20]);
  const y = d3.scaleLinear().range([height, 0]);

  // Create color scale
  const city_color = d3.scaleOrdinal(d3.schemeObservable10);

  // Create line generator
  const line = d3.line()
    .x(d => x(d.month))
    .y(d => y(d.occupancy));

  // Create tooltip
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "booking-waterfall-tooltip")
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

  // Filter data based on selected city
  const filteredData = data.filter((d) => d.city);

  // Get unique months and cities
  const monthsRaw = [...new Set(filteredData.map(d => d.month))];
  const sortedMonthsRaw = monthsRaw.sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    return yearA !== yearB ? yearA - yearB : monthA - monthB;
  });

  const cities = [...new Set(filteredData.map(d => d.city))];

  // Update scales
  const parsedDates = sortedMonthsRaw.map(parseMonth);
  const minDate = d3.min(parsedDates);
  const maxDate = d3.max(parsedDates);

  // Add padding: subtract and add 15 days
  const paddedMin = d3.timeDay.offset(minDate, -15);
  const paddedMax = d3.timeDay.offset(maxDate, 15);


  x.domain([paddedMin, paddedMax]);
  y.domain([0, d3.max(filteredData, d => d.occupancy)]);

  // Group data by city
  const cityMonthMap = new Map();

  filteredData.forEach(d => {
    if (!cityMonthMap.has(d.city)) {
      cityMonthMap.set(d.city, new Map());
    }
    const monthMap = cityMonthMap.get(d.city);
    if (!monthMap.has(d.month)) {
      monthMap.set(d.month, []);
    }
    monthMap.get(d.month).push(d.occupancy);
  });

  const cityData = cities.map(city => {
    const monthMap = cityMonthMap.get(city) || new Map();

    const cityValues = sortedMonthsRaw.map(monthRaw => {
      const values = monthMap.get(monthRaw) || [];
      const avgOccupancy = values.length ? d3.mean(values) : 0;
      return { month: parseMonth(monthRaw), occupancy: avgOccupancy };
    });

    return { city, values: cityValues };
  });

  // Bind data to lines
  const lines = svg.selectAll(".line")
    .data(cityData, d => d.city);

  // Enter new lines
  lines.enter().append("path")
    .attr("class", "line")
    .attr("fill", "none")
    .attr("stroke", d => city_color(d.city))
    .attr("stroke-width", 4)
    .attr("d", d => line(d.values))
    .on("click", function (event, d) {
      event.stopPropagation();  // prevent SVG click reset
      highlightCity(svg, cityData, d.city);
    })
    .each(function () {
      const totalLength = this.getTotalLength();
      d3.select(this)
        .attr("stroke-dasharray", totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(500)  // animate over 2 seconds
        .attr("stroke-dashoffset", 0);
    });

  // Update existing lines
  lines.transition().duration(750)
    .attr("d", d => line(d.values))
    .attr("stroke", d => city_color(d.city))
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 4);

  // Add circles for tooltips
  cityData.forEach(city => {
    svg.selectAll(`.occupancy-line-dot-${city.city.replace(/\s+/g, '-')}`)
      .data(city.values)
      .enter()
      .append("circle")
      .attr("class", `occupancy-line-dot-${city.city.replace(/\s+/g, '-')}`)
      .attr("cx", d => x(d.month))
      .attr("cy", d => y(d.occupancy))
      .attr("r", 4)
      .attr("fill", city_color(city.city))
      .style("opacity", 0)  // <-- start hidden
      .on("click", function (event, d) {
        event.stopPropagation();
        highlightCity(svg, cityData, city.city);
      })
      .on("mouseover", function (event, d) {
        const monthStr = sortedMonthsRaw.find(m => parseMonth(m).getTime() === d.month.getTime());
        const monthName = monthStr ? parseMonth(monthStr).toLocaleString('default', { month: 'short' }) : "";
        tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
        tooltip.html(`<strong>City:</strong> ${city.city}<br>
          <strong>Month:</strong> ${monthName.slice(0, 3)}<br>
          <strong>Occupancy:</strong> ${(d.occupancy * 100).toFixed(2)}%`
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
  });

  // Animate circles by month
  const allCircles = svg.selectAll("circle").nodes();

  // Group circles by month
  const circlesByMonth = d3.group(allCircles, circle => {
    return d3.select(circle).datum().month.getTime();
  });

  const sortedMonths = Array.from(circlesByMonth.keys()).sort((a, b) => a - b);

  sortedMonths.forEach((monthTime, i) => {
    circlesByMonth.get(monthTime).forEach(circle => {
      d3.select(circle)
        .transition()
        .delay(i * 15) // delay per circle group
        .duration(500)
        .style("opacity", 1);
    });
  });

  // Reset highlight when click off line/circle
  svgContainer.on("click", function () {
    resetHighlight(svg, cityData, city_color);
  });

  // Remove old axes
  svg.selectAll(".occupancy-line-x-axis").remove();
  svg.selectAll(".occupancy-line-y-axis").remove();

  // X axis
  svg.append("g")
    .attr("class", "occupancy-line-x-axis")
    .attr("transform", `translate(0, ${height})`)
    .call(
      d3.axisBottom(x)
        .tickValues(parsedDates) // only show ticks for actual months
        .tickFormat(d => d3.timeFormat("%B")(d).slice(0, 3)) // format as "Jan", "Feb", etc.
    )
    .selectAll("text")
    .style("font-size", tick_fontSize)
    .style("fill", font_color)
    .style("font-family", font_family)
    .style("font-weight", font_weight);

  svg.append("text")
    .attr("class", "occupancy-line-x-axis-label")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr('fill', font_color)
    .attr('font-family', font_family)
    .attr('font-size', font_size)
    .attr('font-weight', font_weight)
    .text("Month");


  // Y axis
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(filteredData, d => d.occupancy)])
    .range([height, 0]);

  svg.append("g")
    .attr("class", "occupancy-line-y-axis")
    .attr("transform", `translate(20, 0)`)
    .call(d3.axisLeft(yScale).tickFormat(d => `${d * 100}%`))
    .selectAll("text")
    .style("font-size", tick_fontSize)
    .style("fill", font_color)
    .style("font-family", font_family)
    .style("font-weight", font_weight);

  svg.append("text")
    .attr("class", "occupancy-line-y-axis-label")
    .attr("text-anchor", "middle")
    .attr("transform", `rotate(-90)`)
    .attr("x", -height / 2)
    .attr("y", 0)
    .attr("dy", "-2.5em")
    .attr('fill', font_color)
    .attr('font-family', font_family)
    .attr('font-size', font_size)
    .attr('font-weight', font_weight)
    .text("Occupancy Rate");

  // Legend
  const legendGroup = svg.append("g")
    .attr("class", "occupancy-line-legend-group")
    .attr("transform", `translate(${margin.left / 2 - 10}, ${margin.top + height + 15})`);

  const legend = legendGroup.selectAll(".occupancy-line-legend")
    .data(cities, d => d);

  const legendEnter = legend.enter()
    .append("g")
    .attr("class", "occupancy-line-legend")
    .attr("transform", (d, i) => `translate(${i * 100}, 0)`);

  // Coloured squares
  legendEnter.append("rect")
    .attr("y", 0)
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", city_color);

  // City labels
  legendEnter.append("text")
    .attr("x", 20)
    .attr("y", 7.5)
    .attr("dy", "0.35em")
    .attr("fill", font_color)
    .attr("font-family", font_family)
    .attr("font-size", font_size)
    .attr("font-weight", font_weight)
    .text(d => d + "   ");

  // Spacing between each legend
  legendEnter.merge(legend)
    .attr("transform", (d, i) => `translate(${i * 110}, 10)`);
}
