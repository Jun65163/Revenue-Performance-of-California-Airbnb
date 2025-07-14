function addGeoData(mart_data, geo_data) {
  // Get unique id in geo_data
  const uniqueGeoDataMap = new Map();
  geo_data.forEach(d => {
    delete d.month;
    if (!uniqueGeoDataMap.has(d.unified_id)) {
      uniqueGeoDataMap.set(d.unified_id, d);
    }
  });

  // Left join mart_data with geo_data
  let merged_data = mart_data.map(d1 => {
    const d2 = uniqueGeoDataMap.get(d1.unified_id);
    return {
      ...d1,
      ...(d2 || {})
    };
  });

  // Drop rows with missing latitude or longitude
  merged_data = merged_data.filter(d => d['latitude'] !== undefined && d['longitude'] !== undefined);

  return merged_data;
}

function convertToNum(data, col_list) {
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    for (let j = 0; j < col_list.length; j++) {
      const col = col_list[j];
      let val = row[col];

      if (val === '') {
        row[col] = 0;
      } else {
        // Optimised for speed
        if (val.indexOf(',') !== -1) { //  if has ","
          val = val.replace(',', '.');
        }
        row[col] = parseFloat(val); // replace row with val after convert val to float
      }
    }
  }

  return data;
}

function avgNumCols(data) {
  // Group by id and month
  const groupedDataMap = new Map();

  for (const d of data) {
    const key = `${d.unified_id}_${d.month}`;
    let group = groupedDataMap.get(key);

    if (!group) { // Listing not in map (for specific month)
      group = { count: 1 };

      for (const k in d) {
        const val = d[k];
        if (typeof val === 'number') {
          group[k] = val;
        } else {
          group[k] ??= val;
        }
      }

      groupedDataMap.set(key, group);

    } else { // Listing in map (for specific month)
      group.count += 1;

      for (const k in d) {
        const val = d[k];
        if (typeof val === 'number') {
          group[k] = (group[k] || 0) + val; // Sum all num cols cumulatively
        }
      }
    }
  }

  // Get avg of all num cols
  const avg_data = [];

  for (const group of groupedDataMap.values()) {
    const count = group.count; // avoid destructuring overhead
    const avg_group = {};

    for (const key in group) {
      if (key !== 'count') {
        const val = group[key];
        avg_group[key] = (typeof val === 'number') ? val / count : val;
      }
    }

    avg_data.push(avg_group);
  }

  return avg_data;
}

export function loadData(hasGeoLocation) {
  return new Promise((resolve, reject) => {
    d3.dsv(";", "market_analysis_2019.csv").then(mart_data => {
      d3.dsv(";", "geolocation.csv").then(geo_data => {
        let final_data = mart_data;
        let col_list = ['bathrooms', 'bedrooms', 'guests', 'occupancy', 'openness', 'lead time',
          'revenue', 'length stay', 'nightly rate'];

        if (hasGeoLocation) {
          col_list = [...col_list, 'latitude', 'longitude'];
          final_data = addGeoData(mart_data, geo_data);
        }

        final_data = convertToNum(final_data, col_list);

        // Remove duplicates (listings with the same id and month) then calculate averages of num features for listings
        final_data = avgNumCols(final_data);

        // Debug for checking month from geo_data not copy to mart_data
        // console.log(final_data.filter(d => d.unified_id === "AIR14124182"));

        resolve(final_data); // return final_data

      }).catch(reject);
    }).catch(reject);
  });
}

window.loadData = loadData;