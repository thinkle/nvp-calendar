document.addEventListener("DOMContentLoaded", function () {
  // Configuration
  const calendarUrl = "/.netlify/functions/calendar-proxy";
  const eventsPerPage = 6; // Current day + next 5 events

  fetch(calendarUrl)
    .then((response) => response.text())
    .then((icalData) => {
      console.log("Fetched iCal data");
      // Parse the iCal data
      const jcalData = ICAL.parse(icalData);
      const vcalendar = new ICAL.Component(jcalData);
      const vevents = vcalendar.getAllSubcomponents("vevent");

      console.log(`Total vevents fetched: ${vevents.length}`);

      // Extract and process event details
      // Extract and process event details
      let events = vevents.map((vevent) => {
        const event = new ICAL.Event(vevent);
        const description = event.description || "";

        // Use a regular expression to find ridewithgps links
        const rideWithGpsRegex = /https?:\/\/ridewithgps\.com\/[^"'<\s]*/i;
        const rideWithGpsMatch = description.match(rideWithGpsRegex);
        const routeLink = rideWithGpsMatch ? rideWithGpsMatch[0] : null;

        return {
          summary: event.summary,
          description: description,
          location: event.location,
          startDate: event.startDate.toJSDate(),
          endDate: event.endDate.toJSDate(),
          routeLink: routeLink,
        };
      });

      // Sort events by start date
      events.sort((a, b) => a.startDate - b.startDate);

      console.log(`Total events: ${events.length}`);

      // Find the index of the first event occurring today or in the future
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Reset 'now' to start of the day

      let startIndexForToday = events.findIndex((event) => {
        const eventDate = new Date(event.startDate);
        eventDate.setHours(0, 0, 0, 0); // Reset event date to start of day

        return eventDate >= now;
      });

      // If no future events are found, startIndexForToday will be -1
      if (startIndexForToday === -1) {
        // Start at the last events
        startIndexForToday = events.length - eventsPerPage;
        if (startIndexForToday < 0) startIndexForToday = 0;
        console.log("No future events found. Starting at the last events.");
      }

      // Initialize offset
      let offset = startIndexForToday;

      // Update pagination controls
      const prevButton = document.getElementById("prev-page");
      const nextButton = document.getElementById("next-page");
      const pageInfo = document.getElementById("page-info");

      prevButton.addEventListener("click", () => {
        if (offset > 0) {
          offset -= eventsPerPage;
          if (offset < 0) offset = 0;
          updateTable();
        }
      });

      nextButton.addEventListener("click", () => {
        if (offset + eventsPerPage < events.length) {
          offset += eventsPerPage;
          updateTable();
        }
      });

      function updatePaginationControls() {
        pageInfo.textContent = `Showing events ${offset + 1} to ${Math.min(
          offset + eventsPerPage,
          events.length
        )} of ${events.length}`;
        prevButton.disabled = offset === 0;
        nextButton.disabled = offset + eventsPerPage >= events.length;
        console.log(
          `Pagination updated: offset=${offset}, prevButton.disabled=${prevButton.disabled}, nextButton.disabled=${nextButton.disabled}`
        );
      }

      // Function to update the table based on the current offset
      function updateTable() {
        console.log(`Updating table starting from event ${offset + 1}`);

        // Clear existing table rows except the header
        const table = document.getElementById("events-table");
        const tbody = table.querySelector("tbody");
        tbody.innerHTML = "";        

        // Check if there are events to display
        if (events.length === 0) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = 3;
          cell.textContent = "No events available.";
          cell.style.textAlign = "center";
          row.appendChild(cell);
          tbody.appendChild(row);
          pageInfo.textContent = "";
          prevButton.disabled = true;
          nextButton.disabled = true;
          return;
        }

        // Calculate end index for slicing events array
        const endIndex = offset + eventsPerPage;
        const eventsToDisplay = events.slice(offset, endIndex);

        console.log(
          `Displaying events ${offset + 1} to ${Math.min(
            endIndex,
            events.length
          )} of ${events.length}`
        );

        // Populate the table with events for the current offset
        // Inside the eventsToDisplay.forEach loop
        eventsToDisplay.forEach((event) => {
          const eventDate = event.startDate.toLocaleDateString("en-US", {
            timeZone: "America/New_York",
          });
          const eventTime = event.startDate.toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
          });
          const description = event.summary || "-";
          const routeLink = event.routeLink;

          const row = document.createElement("tr");

          // Existing cells
          // Date cell
          const dateCell = document.createElement("td");
          dateCell.className = "date";
          dateCell.textContent = eventDate;
          row.appendChild(dateCell);

          // Time cell
          const timeCell = document.createElement("td");
          timeCell.className = "time";
          timeCell.textContent = eventTime;
          row.appendChild(timeCell);

          // Event cell
          const descCell = document.createElement("td");
          descCell.className = "desc";
          descCell.textContent = description;
          if (event.description) {
            let descDiv = document.createElement("div");
            descDiv.innerHTML = event.description;
            descDiv.classList.add("detail");
            descCell.appendChild(descDiv);
          }
          row.appendChild(descCell);

          // Route cell
          // Route cell
          const routeCell = document.createElement("td");
          routeCell.className = "route";

          if (routeLink) {
            const link = document.createElement("a");
            link.href = routeLink;
            link.target = "_blank";
            link.textContent = "Route";
            link.className = "route-link"; // Add a class for styling
            link.setAttribute("data-tooltip", "View route on Ride with GPS"); // Add tooltip text
            routeCell.appendChild(link);
          } else {
            routeCell.textContent = "-";
          }

          row.appendChild(routeCell);          

          // Add click event listener to the row to show full description
          row.addEventListener("click", function () {
            row.classList.toggle("show-description");
            console.log("Row clicked", event);
          });

          // Add hover effect to indicate clickability
          row.style.cursor = "pointer";

          tbody.appendChild(row);
        });

        updatePaginationControls();
      }

      // Initial table update
      updateTable();
    })
    .catch((error) => {
      console.error("Error fetching or parsing iCal data:", error);
    });
});
