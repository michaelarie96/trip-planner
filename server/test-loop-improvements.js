require("dotenv").config();
const llmService = require("./services/llmService");

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";

function calculateDistance(coord1, coord2) {
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

function analyzeLoopQuality(coordinates, waypoints) {
  if (!coordinates || coordinates.length < 6) {
    return { overlapPercentage: 0, pathType: "UNKNOWN" };
  }

  // Split route into forward and return halves
  const midPoint = Math.floor(coordinates.length / 2);
  const forwardPath = coordinates.slice(0, midPoint);
  const returnPath = coordinates.slice(midPoint);

  // Check for path overlap
  const tolerance = 0.05; // 50m tolerance
  let matchingSegments = 0;

  for (let i = 0; i < Math.min(forwardPath.length, returnPath.length) - 1; i++) {
    for (let j = 0; j < returnPath.length - 1; j++) {
      const forwardStart = forwardPath[i];
      const forwardEnd = forwardPath[i + 1];
      const returnStart = returnPath[j];
      const returnEnd = returnPath[j + 1];

      // Check if segments match (reversed)
      const startToEnd = calculateDistance(forwardStart, returnEnd);
      const endToStart = calculateDistance(forwardEnd, returnStart);

      if (startToEnd < tolerance && endToStart < tolerance) {
        matchingSegments++;
        break;
      }
    }
  }

  const overlapPercentage = (matchingSegments / Math.min(forwardPath.length - 1, returnPath.length - 1)) * 100;

  let pathType;
  if (overlapPercentage > 70) {
    pathType = "OUT_AND_BACK";
  } else if (overlapPercentage < 30) {
    pathType = "PROPER_LOOP";
  } else {
    pathType = "PARTIAL_LOOP";
  }

  return { overlapPercentage, pathType, forwardPath: forwardPath.length, returnPath: returnPath.length, matchingSegments };
}

async function testSingleLocation(location, country = null) {
  const testLocation = country ? `${location}, ${country}` : location;
  
  console.log(`\n${BLUE}Testing: ${testLocation}${RESET}`);
  console.log("=".repeat(50));
  
  try {
    const startTime = Date.now();
    const route = await llmService.generateRoute(
      country || location,
      "trekking",
      country ? location : null
    );
    const duration = Date.now() - startTime;
    
    const routeData = route.routeData;
    const coordinates = routeData.coordinates;
    const waypoints = routeData.waypoints;
    
    // Analyze loop quality
    const loopAnalysis = analyzeLoopQuality(coordinates, waypoints);
    
    // Print waypoints
    console.log(`\n${MAGENTA}Waypoints (${waypoints.length}):${RESET}`);
    waypoints.slice(0, 6).forEach((wp, idx) => {
      console.log(`  ${idx + 1}. ${wp}`);
    });
    if (waypoints.length > 6) {
      console.log(`  ... and ${waypoints.length - 6} more`);
    }
    
    // Print analysis
    console.log(`\n${BLUE}Loop Analysis:${RESET}`);
    console.log(`  Path Type: ${loopAnalysis.pathType}`);
    console.log(`  Overlap: ${loopAnalysis.overlapPercentage.toFixed(1)}%`);
    console.log(`  Forward/Return Points: ${loopAnalysis.forwardPath}/${loopAnalysis.returnPath}`);
    console.log(`  Routing Method: ${route.routingMetadata?.method || 'unknown'}`);
    console.log(`  Generation Time: ${duration}ms`);
    
    // Status
    const status = loopAnalysis.pathType === "PROPER_LOOP" ? "PASS" :
                   loopAnalysis.pathType === "PARTIAL_LOOP" ? "WARNING" : "FAIL";
    const statusColor = status === "PASS" ? GREEN : status === "WARNING" ? YELLOW : RED;
    
    console.log(`\n${statusColor}Status: ${status} - ${loopAnalysis.pathType}${RESET}`);
    
    return {
      location: testLocation,
      pathType: loopAnalysis.pathType,
      overlap: loopAnalysis.overlapPercentage,
      status
    };
    
  } catch (error) {
    console.error(`${RED}Failed: ${error.message}${RESET}`);
    return { location: testLocation, status: "ERROR", error: error.message };
  }
}

async function runTest() {
  console.log(`${BLUE}=== TESTING LOOP QUALITY IMPROVEMENTS ===${RESET}`);
  console.log("Testing if routes now form proper loops instead of retracing paths\n");
  
  const results = [];
  
  // Test same locations as before to compare
  const testCases = [
    { location: "Interlaken", country: "Switzerland" },
    { location: "Bergen", country: "Norway" },
    { location: "Queenstown", country: "New Zealand" }
  ];
  
  for (const test of testCases) {
    const result = await testSingleLocation(test.location, test.country);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Summary
  console.log(`\n${BLUE}=== SUMMARY ===${RESET}`);
  console.log("=".repeat(50));
  
  const properLoops = results.filter(r => r.pathType === "PROPER_LOOP").length;
  const partialLoops = results.filter(r => r.pathType === "PARTIAL_LOOP").length;
  const outAndBack = results.filter(r => r.pathType === "OUT_AND_BACK").length;
  const errors = results.filter(r => r.status === "ERROR").length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`${GREEN}✓ Proper Loops: ${properLoops}${RESET}`);
  console.log(`${YELLOW}⚠ Partial Loops: ${partialLoops}${RESET}`);
  console.log(`${RED}✗ Out-and-Back: ${outAndBack}${RESET}`);
  if (errors > 0) console.log(`${RED}Errors: ${errors}${RESET}`);
  
  console.log(`\n${BLUE}Details:${RESET}`);
  results.forEach(r => {
    if (r.status !== "ERROR") {
      const color = r.status === "PASS" ? GREEN : r.status === "WARNING" ? YELLOW : RED;
      console.log(`${color}${r.location}: ${r.pathType} (${r.overlap.toFixed(1)}% overlap)${RESET}`);
    } else {
      console.log(`${RED}${r.location}: ERROR - ${r.error}${RESET}`);
    }
  });
  
  // Check for improvement
  console.log(`\n${BLUE}Improvement Analysis:${RESET}`);
  if (properLoops > 0) {
    console.log(`${GREEN}✓ Successfully generating proper loops!${RESET}`);
  }
  if (outAndBack === 0) {
    console.log(`${GREEN}✓ No more simple out-and-back routes!${RESET}`);
  } else if (outAndBack < results.length / 2) {
    console.log(`${YELLOW}⚠ Reduced out-and-back routes to ${outAndBack}/${results.length}${RESET}`);
  } else {
    console.log(`${RED}✗ Still generating too many out-and-back routes${RESET}`);
  }
  
  const avgOverlap = results
    .filter(r => r.overlap !== undefined)
    .reduce((sum, r) => sum + r.overlap, 0) / results.filter(r => r.overlap !== undefined).length;
  
  console.log(`Average path overlap: ${avgOverlap.toFixed(1)}%`);
  if (avgOverlap < 40) {
    console.log(`${GREEN}✓ Good loop quality with low path retracing${RESET}`);
  } else if (avgOverlap < 60) {
    console.log(`${YELLOW}⚠ Moderate loop quality, some improvement needed${RESET}`);
  } else {
    console.log(`${RED}✗ High path overlap indicates retracing issues${RESET}`);
  }
}

runTest().catch(error => {
  console.error(`${RED}Test failed: ${error.message}${RESET}`);
  process.exit(1);
});