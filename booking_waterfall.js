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

export function bookingWaterfallChart({ data, className,
    top_margin = 20, bottom_margin = 40, left_margin = 50, right_margin = 30,
    tick_fontSize = 12,
    aboveAvgColour = "green", belowAvgColour = "red",
    avgLine_color = "black", avgLine_dashNum = 0, avgLine_weight = 1,
    bar_posOffset = 0,
    yLabel_offset = 60, xLabel_offset = 35,
    font_color = 'black', font_family = 'Arial', font_size = 12, font_weight = 'normal',
    anime_duration = 500, anime_barSeqDelay = 50,
    tooltip_borderRad = 4, tooltip_fadeIn = 200, tooltip_fadeOut = 500, tooltip_opacity = 0.9,
    avgLabel_offsetX = 110, avgLabel_offsetY = 23 }
) {
    /// LOCAL DATA PREPROCESS ///
    // Convert the month to actual months only (Jan, Feb...)
    const date_cache = new Map(); // Done to reduce LCP (speed up chart load time)
    const chartData = data.map(d => ({
        ...d,
        month: getMonthOnly(d.month, date_cache)
    }));

    // Get sum of guests for each month (group by month, then get sum for that month)
    const guestsByMonth = Array.from(
        d3.rollup(
            chartData,
            v => d3.sum(v, d => d.guests),
            d => d.month // group by month
        ),
        ([month, numOfGuests]) => ({ month, numOfGuests })
    );

    /// DATA SETUP ///
    // Get avg num of guests for months
    const avgGuests = d3.mean(guestsByMonth, d => d.numOfGuests);

    // Sort months
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Using this sort since Sep in Edge is "Sept" but "Sep" in Chrome
    guestsByMonth.sort((a, b) => {
        const aIndex = monthOrder.indexOf((a.month).slice(0, 3));
        const bIndex = monthOrder.indexOf((b.month).slice(0, 3));
        return aIndex - bIndex;
    });


    /// SETTINGS FOR DISPLAY ///
    // Select svg by class
    const svg = d3.select(className);
    svg.selectAll("*").remove(); // Redraw chart (no update needed since it'll become chart junk)

    const { width: svgWidth, height: svgHeight } = svg.node().getBoundingClientRect();

    // Set up actual chart width and height according to margin
    const margin = { top: top_margin, right: right_margin, bottom: bottom_margin, left: left_margin + yLabel_offset };
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    /// CHART CREATION ///
    // Create group (this is to move chart by margins)
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x_axis = d3.scaleBand()
        .domain(guestsByMonth.map(d => d.month))
        .range([0, chartWidth])
        .padding(0.2);

    const y_axis = d3.scaleLinear()
        .domain([
            d3.min(guestsByMonth, d => Math.min(d.numOfGuests, avgGuests)),
            d3.max(guestsByMonth, d => Math.max(d.numOfGuests, avgGuests))
        ])
        .nice()
        .range([chartHeight, 0]);


    // Create bars
    const bars = g.selectAll(".booking-waterfall-bar")
        .data(guestsByMonth)
        .enter()
        .append("rect")
        .attr("class", d => `booking-waterfall-bar- ${d.numOfGuests >= avgGuests ? "above" : "below"}`)
        .attr("x", d => x_axis(d.month))
        .attr("width", x_axis.bandwidth())
        .attr("y", y_axis(avgGuests)) // Start from avg line (animation purpose)
        .attr("height", 0) // Start from height 0 (animation purpose)
        .attr("fill", d => d.numOfGuests >= avgGuests ? aboveAvgColour : belowAvgColour);


    // Avg line
    g.append("line")
        .attr("class", "booking-waterfall-AvgLine")
        .attr("x1", 0)
        .attr("x2", chartWidth)
        .attr("y1", y_axis(avgGuests))
        .attr("y2", y_axis(avgGuests))
        .attr("stroke", avgLine_color)
        .attr("stroke-width", avgLine_weight)
        .attr("stroke-dasharray", avgLine_dashNum);

    // Avg label
    const avgLabelGroup = g.append("g")
        .attr("class", "booking-waterfall-AvgLabelGroup")
        .attr("transform", `translate(${-margin.left + avgLabel_offsetX}, ${y_axis(avgGuests) - avgLabel_offsetY})`); // Align with y-axis and above the line

    // Avg label txt size
    const avgText = avgLabelGroup.append("text")
        .text(`Average: ${avgGuests.toFixed(2)}`)
        .attr("x", 8)
        .attr("y", 16)
        .attr("fill", font_color)
        .attr("font-family", font_family)
        .attr("font-size", font_size)
        .attr("font-weight", font_weight);

    // Avg label box
    const textBBox = avgText.node().getBBox();
    avgLabelGroup.insert("rect", "text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", textBBox.width + 16)
        .attr("height", textBBox.height + 8)
        .attr("fill", "#f0f0f0")
        .attr("opacity", 0.7)
        .attr("rx", 4)
        .attr("ry", 4);


    // Create x and y axis
    g.append("g") // x axis
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x_axis))
        .selectAll("text")
        .style("font-size", tick_fontSize)
        .style("fill", font_color)
        .style("font-family", font_family)
        .style("font-weight", font_weight);

    g.append("g") // y axis
        .call(d3.axisLeft(y_axis))
        .selectAll("text")
        .style("font-size", tick_fontSize)
        .style("fill", font_color)
        .style("font-family", font_family)
        .style("font-weight", font_weight);


    // X and Y axis label
    g.append("text") // x axis label
        .text("Month")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight + xLabel_offset)
        .attr("text-anchor", "middle")
        .attr('fill', font_color)
        .attr('font-family', font_family)
        .attr('font-size', font_size)
        .attr('font-weight', font_weight);

    g.append("text") // y axis label
        .text("Number of Guests")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", -yLabel_offset)
        .attr("text-anchor", "middle")
        .attr('fill', font_color)
        .attr('font-family', font_family)
        .attr('font-size', font_size)
        .attr('font-weight', font_weight);


    /// ANIMATION FOR GROWING BARS /// 
    bars.transition()
        .delay((d, i) => i * anime_barSeqDelay)
        .duration(anime_duration)
        .attr("y", d => d.numOfGuests >= avgGuests ? y_axis(d.numOfGuests) - bar_posOffset : y_axis(avgGuests) + bar_posOffset)
        .attr("height", d => Math.abs(y_axis(d.numOfGuests) - y_axis(avgGuests)));


    /// TOOL TIP INTERACTION ///
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

    bars.on("mouseover", function (event, d) {
        tooltip.transition().duration(tooltip_fadeIn).style("opacity", tooltip_opacity);
        tooltip.html(`<strong>Month:</strong> ${d.month}<br><strong>Guests:</strong> ${d.numOfGuests}`)
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
