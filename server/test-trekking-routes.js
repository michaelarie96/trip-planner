require("dotenv").config();
const llmService = require("./services/llmService");

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";

class TrekkingRouteAnalyzer {
  constructor() {
    this.testResults = [];
    this.issues = {
      notCircular: [],
      distanceExceeded: [],
      distanceMismatch: [],
      pathRetracing: [],
    };
  }

  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
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

  calculateTotalRouteDistance(coordinates) {
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      totalDistance += this.calculateDistance(
        coordinates[i],
        coordinates[i + 1]
      );
    }
    return totalDistance;
  }

  checkCircularity(coordinates) {
    if (!coordinates || coordinates.length < 2) {
      return { isCircular: false, startEndDistance: null };
    }

    const startCoord = coordinates[0];
    const endCoord = coordinates[coordinates.length - 1];
    const distance = this.calculateDistance(startCoord, endCoord);

    // Consider route circular if start and end are within 100 meters
    const isCircular = distance < 0.1; // 0.1 km = 100 meters

    return {
      isCircular,
      startEndDistance: distance,
      startPoint: startCoord,
      endPoint: endCoord,
    };
  }

  detectPathRetracing(coordinates) {
    if (!coordinates || coordinates.length < 4) {
      return { isRetracing: false };
    }

    // Check if route follows similar path backwards
    const halfPoint = Math.floor(coordinates.length / 2);
    const firstHalf = coordinates.slice(0, halfPoint);
    const secondHalf = coordinates.slice(halfPoint);

    let matchingSegments = 0;
    const tolerance = 0.05; // 50 meters tolerance

    // Compare segments
    for (let i = 0; i < Math.min(firstHalf.length, secondHalf.length); i++) {
      const forwardPoint = firstHalf[i];
      const backwardPoint = secondHalf[secondHalf.length - 1 - i];

      const distance = this.calculateDistance(forwardPoint, backwardPoint);
      if (distance < tolerance) {
        matchingSegments++;
      }
    }

    const retracingPercentage =
      matchingSegments / Math.min(firstHalf.length, secondHalf.length);
    const isRetracing = retracingPercentage > 0.6; // More than 60% matching indicates retracing

    return {
      isRetracing,
      retracingPercentage: Math.round(retracingPercentage * 100),
      matchingSegments,
      totalSegments: Math.min(firstHalf.length, secondHalf.length),
    };
  }

  analyzeRoute(route, testLocation) {
    const analysis = {
      location: testLocation,
      timestamp: new Date().toISOString(),
      issues: [],
      warnings: [],
      passes: [],
    };

    // Extract route data
    const routeData = route.routeData;
    const coordinates = routeData.coordinates;
    const llmTotalDistance = routeData.totalDistance;
    const dailyRoutes = routeData.dailyRoutes || [];

    // 1. Check Circularity
    const circularityCheck = this.checkCircularity(coordinates);
    analysis.circularityCheck = circularityCheck;

    if (!circularityCheck.isCircular) {
      analysis.issues.push(
        `❌ Route is NOT circular: Start/End distance = ${(
          circularityCheck.startEndDistance * 1000
        ).toFixed(0)}m`
      );
      this.issues.notCircular.push(testLocation);
    } else {
      analysis.passes.push(
        `✅ Route is circular: Start/End distance = ${(
          circularityCheck.startEndDistance * 1000
        ).toFixed(0)}m`
      );
    }

    // 2. Check Distance Constraints (5-15km)
    analysis.llmDistance = llmTotalDistance;

    if (llmTotalDistance < 5 || llmTotalDistance > 15) {
      analysis.issues.push(
        `❌ Distance constraint violated: ${llmTotalDistance}km (should be 5-15km)`
      );
      this.issues.distanceExceeded.push({
        location: testLocation,
        distance: llmTotalDistance,
      });
    } else {
      analysis.passes.push(
        `✅ Distance within constraints: ${llmTotalDistance}km`
      );
    }

    // 3. Calculate actual route distance from coordinates
    const calculatedDistance = this.calculateTotalRouteDistance(coordinates);
    analysis.calculatedDistance = calculatedDistance;

    const distanceDiscrepancy = Math.abs(llmTotalDistance - calculatedDistance);
    const discrepancyPercentage = (distanceDiscrepancy / llmTotalDistance) * 100;

    if (discrepancyPercentage > 20) {
      // More than 20% difference
      analysis.issues.push(
        `❌ Distance mismatch: LLM says ${llmTotalDistance.toFixed(
          2
        )}km, calculated ${calculatedDistance.toFixed(2)}km (${discrepancyPercentage.toFixed(
          1
        )}% difference)`
      );
      this.issues.distanceMismatch.push({
        location: testLocation,
        llmDistance: llmTotalDistance,
        calculatedDistance,
        discrepancy: discrepancyPercentage,
      });
    } else if (discrepancyPercentage > 10) {
      analysis.warnings.push(
        `⚠️ Minor distance discrepancy: ${discrepancyPercentage.toFixed(1)}%`
      );
    } else {
      analysis.passes.push(
        `✅ Distance calculations match: ${discrepancyPercentage.toFixed(1)}% difference`
      );
    }

    // 4. Check for path retracing
    const retracingCheck = this.detectPathRetracing(coordinates);
    analysis.retracingCheck = retracingCheck;

    if (retracingCheck.isRetracing) {
      analysis.issues.push(
        `❌ Route retraces path: ${retracingCheck.retracingPercentage}% of segments match backward path`
      );
      this.issues.pathRetracing.push({
        location: testLocation,
        percentage: retracingCheck.retracingPercentage,
      });
    } else {
      analysis.passes.push(
        `✅ Route forms proper loop: Only ${retracingCheck.retracingPercentage}% path overlap`
      );
    }

    // 5. Check start/end point names
    if (dailyRoutes.length > 0 && dailyRoutes[0]) {
      const day1 = dailyRoutes[0];
      analysis.startPointName = day1.startPoint;
      analysis.endPointName = day1.endPoint;

      if (day1.startPoint !== day1.endPoint) {
        analysis.warnings.push(
          `⚠️ Start/End names don't match: "${day1.startPoint}" vs "${day1.endPoint}"`
        );
      } else {
        analysis.passes.push(
          `✅ Start/End names match: "${day1.startPoint}"`
        );
      }
    }

    // 6. Check routing metadata
    const routingMetadata = route.routingMetadata;
    if (routingMetadata) {
      analysis.routingMethod = routingMetadata.method;
      analysis.routingError = routingMetadata.error;

      if (routingMetadata.error) {
        analysis.warnings.push(
          `⚠️ Routing had errors: ${routingMetadata.error}`
        );
      }

      if (routingMetadata.method === "mock_fallback") {
        analysis.warnings.push(
          `⚠️ Using mock coordinates (geocoding/routing failed)`
        );
      }
    }

    // Calculate overall status
    analysis.status =
      analysis.issues.length === 0
        ? "PASS"
        : analysis.warnings.length > 0 && analysis.issues.length === 0
        ? "WARNING"
        : "FAIL";

    return analysis;
  }

  async testLocation(location, country = null) {
    const testLocation = country ? `${location}, ${country}` : location;
    console.log(`\n${BLUE}Testing: ${testLocation}${RESET}`);
    console.log("=" .repeat(50));

    try {
      const startTime = Date.now();
      const route = await llmService.generateRoute(
        country || location,
        "trekking",
        country ? location : null
      );
      const duration = Date.now() - startTime;

      const analysis = this.analyzeRoute(route, testLocation);
      analysis.generationTime = duration;

      // Print results
      this.printAnalysis(analysis);

      this.testResults.push(analysis);
      return analysis;
    } catch (error) {
      console.error(`${RED}❌ Failed to generate route: ${error.message}${RESET}`);
      return {
        location: testLocation,
        status: "ERROR",
        error: error.message,
      };
    }
  }

  printAnalysis(analysis) {
    // Status header
    const statusColor =
      analysis.status === "PASS"
        ? GREEN
        : analysis.status === "WARNING"
        ? YELLOW
        : RED;
    console.log(`\n${statusColor}Status: ${analysis.status}${RESET}`);

    // Print passes
    if (analysis.passes && analysis.passes.length > 0) {
      console.log(`\n${GREEN}Passes:${RESET}`);
      analysis.passes.forEach((pass) => console.log(`  ${pass}`));
    }

    // Print warnings
    if (analysis.warnings && analysis.warnings.length > 0) {
      console.log(`\n${YELLOW}Warnings:${RESET}`);
      analysis.warnings.forEach((warning) => console.log(`  ${warning}`));
    }

    // Print issues
    if (analysis.issues && analysis.issues.length > 0) {
      console.log(`\n${RED}Issues:${RESET}`);
      analysis.issues.forEach((issue) => console.log(`  ${issue}`));
    }

    // Print metadata
    console.log(`\n${MAGENTA}Metadata:${RESET}`);
    console.log(`  Generation time: ${analysis.generationTime}ms`);
    console.log(`  Routing method: ${analysis.routingMethod || "unknown"}`);
    console.log(`  Coordinates: ${analysis.circularityCheck ? "Available" : "Missing"}`);
    console.log(`  LLM Distance: ${analysis.llmDistance}km`);
    console.log(`  Calculated Distance: ${analysis.calculatedDistance?.toFixed(2)}km`);
  }

  printSummary() {
    console.log("\n" + "=".repeat(60));
    console.log(`${BLUE}TESTING SUMMARY${RESET}`);
    console.log("=".repeat(60));

    const totalTests = this.testResults.length;
    const passed = this.testResults.filter((r) => r.status === "PASS").length;
    const warnings = this.testResults.filter((r) => r.status === "WARNING").length;
    const failed = this.testResults.filter((r) => r.status === "FAIL").length;
    const errors = this.testResults.filter((r) => r.status === "ERROR").length;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`${GREEN}Passed: ${passed}${RESET}`);
    console.log(`${YELLOW}Warnings: ${warnings}${RESET}`);
    console.log(`${RED}Failed: ${failed}${RESET}`);
    console.log(`${RED}Errors: ${errors}${RESET}`);

    // Issue breakdown
    console.log(`\n${RED}Issue Breakdown:${RESET}`);
    console.log(`  Not Circular: ${this.issues.notCircular.length} routes`);
    console.log(`  Distance Exceeded: ${this.issues.distanceExceeded.length} routes`);
    console.log(`  Distance Mismatch: ${this.issues.distanceMismatch.length} routes`);
    console.log(`  Path Retracing: ${this.issues.pathRetracing.length} routes`);

    // Detailed issue information
    if (this.issues.distanceExceeded.length > 0) {
      console.log(`\n${RED}Distance Violations:${RESET}`);
      this.issues.distanceExceeded.forEach((issue) => {
        console.log(`  ${issue.location}: ${issue.distance}km`);
      });
    }

    if (this.issues.distanceMismatch.length > 0) {
      console.log(`\n${RED}Distance Mismatches:${RESET}`);
      this.issues.distanceMismatch.forEach((issue) => {
        console.log(
          `  ${issue.location}: LLM=${issue.llmDistance.toFixed(
            1
          )}km, Calculated=${issue.calculatedDistance.toFixed(1)}km (${issue.discrepancy.toFixed(
            1
          )}% diff)`
        );
      });
    }
  }
}

// Main test runner
async function runTests() {
  console.log(`${BLUE}=== TREKKING ROUTE VALIDATION TEST ===${RESET}`);
  console.log(`Testing trekking route generation for circularity and distance constraints\n`);

  const analyzer = new TrekkingRouteAnalyzer();

  // Test locations - mix of cities and countries
  const testLocations = [
    { location: "Switzerland" },
    { location: "Interlaken", country: "Switzerland" },
    { location: "Norway" },
    { location: "Bergen", country: "Norway" },
    { location: "New Zealand" },
    { location: "Queenstown", country: "New Zealand" },
    { location: "Peru" },
    { location: "Cusco", country: "Peru" },
    { location: "Japan" },
    { location: "Kyoto", country: "Japan" },
  ];

  // Run tests sequentially
  for (const test of testLocations) {
    await analyzer.testLocation(test.location, test.country);
    
    // Small delay between tests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Print summary
  analyzer.printSummary();

  // Save detailed results to file
  const fs = require("fs");
  const resultsFile = `trekking-test-results-${Date.now()}.json`;
  fs.writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        summary: {
          totalTests: analyzer.testResults.length,
          issues: analyzer.issues,
        },
        detailedResults: analyzer.testResults,
      },
      null,
      2
    )
  );
  console.log(`\n${GREEN}Detailed results saved to: ${resultsFile}${RESET}`);
}

// Run the tests
runTests().catch((error) => {
  console.error(`${RED}Test runner failed: ${error.message}${RESET}`);
  process.exit(1);
});