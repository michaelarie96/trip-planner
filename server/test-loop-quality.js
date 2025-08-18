require("dotenv").config();
const llmService = require("./services/llmService");

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";

class LoopQualityAnalyzer {
  calculateDistance(coord1, coord2) {
    const R = 6371;
    const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
    const dLng = ((coord2[1] - coord1[1]) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1[0] * Math.PI) / 180) *
        Math.cos((coord2[0] * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Analyze if route is retracing (A→B→C→C→B→A) vs proper loop (A→B→C→D→A)
   */
  analyzePathRetracing(coordinates, waypoints) {
    if (!coordinates || coordinates.length < 6) {
      return { isRetracing: false, analysis: "Too few coordinates to analyze" };
    }

    const analysis = {
      totalCoordinates: coordinates.length,
      waypoints: waypoints,
      segments: [],
      retracingSegments: 0,
      forwardPath: [],
      returnPath: [],
      overlapPercentage: 0,
      isRetracing: false,
      pathType: "unknown"
    };

    // Split route into forward and return paths
    const midPoint = Math.floor(coordinates.length / 2);
    analysis.forwardPath = coordinates.slice(0, midPoint);
    analysis.returnPath = coordinates.slice(midPoint);

    // Analyze segment-by-segment overlap
    const tolerance = 0.05; // 50m tolerance for "same" point
    let matchingSegments = 0;

    for (let i = 0; i < Math.min(analysis.forwardPath.length, analysis.returnPath.length) - 1; i++) {
      const forwardSegment = {
        start: analysis.forwardPath[i],
        end: analysis.forwardPath[i + 1]
      };
      
      // Check if any return segment matches this forward segment (reversed)
      for (let j = 0; j < analysis.returnPath.length - 1; j++) {
        const returnSegment = {
          start: analysis.returnPath[j],
          end: analysis.returnPath[j + 1]
        };

        // Check if segments are the same (in reverse)
        const startToEnd = this.calculateDistance(forwardSegment.start, returnSegment.end);
        const endToStart = this.calculateDistance(forwardSegment.end, returnSegment.start);

        if (startToEnd < tolerance && endToStart < tolerance) {
          matchingSegments++;
          analysis.segments.push({
            forward: `${i}-${i+1}`,
            return: `${j}-${j+1}`,
            match: true
          });
          break;
        }
      }
    }

    analysis.retracingSegments = matchingSegments;
    analysis.overlapPercentage = (matchingSegments / Math.min(analysis.forwardPath.length - 1, analysis.returnPath.length - 1)) * 100;

    // Determine path type
    if (analysis.overlapPercentage > 70) {
      analysis.isRetracing = true;
      analysis.pathType = "OUT_AND_BACK";
    } else if (analysis.overlapPercentage < 30) {
      analysis.isRetracing = false;
      analysis.pathType = "PROPER_LOOP";
    } else {
      analysis.isRetracing = false;
      analysis.pathType = "PARTIAL_LOOP";
    }

    // Check waypoint diversity
    analysis.waypointDiversity = this.analyzeWaypointDiversity(waypoints);

    return analysis;
  }

  /**
   * Analyze waypoint diversity (are they spread out or linear?)
   */
  analyzeWaypointDiversity(waypoints) {
    if (!waypoints || waypoints.length < 3) {
      return { diverse: false, reason: "Too few waypoints" };
    }

    // Check if waypoints are unique
    const uniqueWaypoints = [...new Set(waypoints.map(w => w.toLowerCase().trim()))];
    
    if (uniqueWaypoints.length < waypoints.length * 0.8) {
      return { 
        diverse: false, 
        reason: "Duplicate waypoints detected",
        uniqueCount: uniqueWaypoints.length,
        totalCount: waypoints.length
      };
    }

    // Check waypoint naming pattern (if they're numbered sequentially, likely linear)
    const linearPatterns = [
      /point \d+/i,
      /stop \d+/i,
      /waypoint \d+/i,
      /km \d+/i
    ];

    const hasLinearNaming = waypoints.some(w => 
      linearPatterns.some(pattern => pattern.test(w))
    );

    if (hasLinearNaming) {
      return {
        diverse: false,
        reason: "Linear waypoint naming pattern detected"
      };
    }

    return {
      diverse: true,
      reason: "Waypoints appear diverse",
      uniqueCount: uniqueWaypoints.length
    };
  }

  /**
   * Visualize the route pattern in ASCII
   */
  visualizeRoutePattern(coordinates) {
    if (!coordinates || coordinates.length < 4) return "Too few points to visualize";

    // Create a simple grid representation
    const minLat = Math.min(...coordinates.map(c => c[0]));
    const maxLat = Math.max(...coordinates.map(c => c[0]));
    const minLng = Math.min(...coordinates.map(c => c[1]));
    const maxLng = Math.max(...coordinates.map(c => c[1]));

    const gridSize = 20;
    const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));

    // Plot points on grid
    coordinates.forEach((coord, idx) => {
      const y = Math.floor((coord[0] - minLat) / (maxLat - minLat) * (gridSize - 1));
      const x = Math.floor((coord[1] - minLng) / (maxLng - minLng) * (gridSize - 1));
      
      if (idx === 0) {
        grid[gridSize - 1 - y][x] = 'S'; // Start
      } else if (idx === coordinates.length - 1) {
        grid[gridSize - 1 - y][x] = 'E'; // End
      } else if (idx < coordinates.length / 2) {
        grid[gridSize - 1 - y][x] = '→'; // Forward path
      } else {
        grid[gridSize - 1 - y][x] = '←'; // Return path
      }
    });

    return grid.map(row => row.join('')).join('\n');
  }
}

async function testLoopQuality(location, country = null) {
  const analyzer = new LoopQualityAnalyzer();
  const testLocation = country ? `${location}, ${country}` : location;
  
  console.log(`\n${BLUE}Testing Loop Quality: ${testLocation}${RESET}`);
  console.log("=".repeat(60));

  try {
    const route = await llmService.generateRoute(
      country || location,
      "trekking",
      country ? location : null
    );

    const routeData = route.routeData;
    const coordinates = routeData.coordinates;
    const waypoints = routeData.waypoints;

    // Analyze path retracing
    const pathAnalysis = analyzer.analyzePathRetracing(coordinates, waypoints);

    // Print waypoints
    console.log(`\n${MAGENTA}WAYPOINTS (${waypoints.length}):${RESET}`);
    waypoints.forEach((wp, idx) => {
      console.log(`  ${idx + 1}. ${wp}`);
    });

    // Print path analysis
    console.log(`\n${BLUE}PATH ANALYSIS:${RESET}`);
    console.log(`  Path Type: ${pathAnalysis.pathType}`);
    console.log(`  Forward Path Points: ${pathAnalysis.forwardPath.length}`);
    console.log(`  Return Path Points: ${pathAnalysis.returnPath.length}`);
    console.log(`  Retracing Segments: ${pathAnalysis.retracingSegments}`);
    console.log(`  Overlap Percentage: ${pathAnalysis.overlapPercentage.toFixed(1)}%`);

    // Print waypoint diversity
    console.log(`\n${BLUE}WAYPOINT DIVERSITY:${RESET}`);
    console.log(`  Diverse: ${pathAnalysis.waypointDiversity.diverse ? 'YES' : 'NO'}`);
    console.log(`  Reason: ${pathAnalysis.waypointDiversity.reason}`);
    if (pathAnalysis.waypointDiversity.uniqueCount) {
      console.log(`  Unique Waypoints: ${pathAnalysis.waypointDiversity.uniqueCount}`);
    }

    // Visualize route
    console.log(`\n${BLUE}ROUTE VISUALIZATION:${RESET}`);
    console.log(analyzer.visualizeRoutePattern(coordinates.filter((_, idx) => idx % 3 === 0))); // Sample every 3rd point

    // Overall assessment
    const status = pathAnalysis.pathType === "PROPER_LOOP" ? "PASS" : 
                   pathAnalysis.pathType === "PARTIAL_LOOP" ? "WARNING" : "FAIL";
    const statusColor = status === "PASS" ? GREEN : status === "WARNING" ? YELLOW : RED;
    
    console.log(`\n${statusColor}LOOP QUALITY: ${status}${RESET}`);
    
    if (pathAnalysis.isRetracing) {
      console.log(`${RED}⚠️ Route is retracing the same path (out-and-back)${RESET}`);
    } else if (pathAnalysis.pathType === "PROPER_LOOP") {
      console.log(`${GREEN}✓ Route forms a proper loop with minimal retracing${RESET}`);
    } else {
      console.log(`${YELLOW}⚠️ Route is a partial loop with some retracing${RESET}`);
    }

    return {
      location: testLocation,
      pathType: pathAnalysis.pathType,
      overlapPercentage: pathAnalysis.overlapPercentage,
      waypointDiversity: pathAnalysis.waypointDiversity.diverse,
      status
    };

  } catch (error) {
    console.error(`${RED}Failed: ${error.message}${RESET}`);
    return { location: testLocation, status: "ERROR", error: error.message };
  }
}

async function runTests() {
  console.log(`${BLUE}=== TREKKING LOOP QUALITY ANALYSIS ===${RESET}`);
  console.log("Testing whether routes form proper loops or just retrace paths\n");

  const results = [];

  // Test various locations
  const testLocations = [
    { location: "Interlaken", country: "Switzerland" },
    { location: "Bergen", country: "Norway" },
    { location: "Queenstown", country: "New Zealand" }
  ];

  for (const test of testLocations) {
    const result = await testLoopQuality(test.location, test.country);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Summary
  console.log(`\n${BLUE}=== SUMMARY ===${RESET}`);
  console.log("=".repeat(60));

  const properLoops = results.filter(r => r.pathType === "PROPER_LOOP").length;
  const partialLoops = results.filter(r => r.pathType === "PARTIAL_LOOP").length;
  const outAndBack = results.filter(r => r.pathType === "OUT_AND_BACK").length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`${GREEN}Proper Loops: ${properLoops}${RESET}`);
  console.log(`${YELLOW}Partial Loops: ${partialLoops}${RESET}`);
  console.log(`${RED}Out-and-Back: ${outAndBack}${RESET}`);

  results.forEach(r => {
    if (r.status !== "ERROR") {
      const color = r.status === "PASS" ? GREEN : r.status === "WARNING" ? YELLOW : RED;
      console.log(`${color}${r.location}: ${r.pathType} (${r.overlapPercentage.toFixed(1)}% overlap)${RESET}`);
    }
  });
}

runTests().catch(error => {
  console.error(`${RED}Test failed: ${error.message}${RESET}`);
  process.exit(1);
});