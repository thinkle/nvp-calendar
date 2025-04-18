document.addEventListener("DOMContentLoaded", function () {
  // Configuration
  const calendarUrl = "/.netlify/functions/calendar-proxy";
  const eventsPerPage = 6; // This will be replaced with date-based filtering

  fetch(calendarUrl)
    .then((response) => response.text())
    .then((icalData) => {
      // Parse the iCal data
      const jcalData = ICAL.parse(icalData);
      const vcalendar = new ICAL.Component(jcalData);
      const vevents = vcalendar.getAllSubcomponents("vevent");

      let today = new Date();
      let stopRecurringAfter = today.getTime() + 120 * 24 * 60 * 60 * 1000; // 120 days from now
      let stopRecurringBefore = today.getTime() - 120 * 24 * 60 * 60 * 1000; // 120 days before now

      // Extract and process event details
      let events = vevents.flatMap((vevent) => {
        const event = new ICAL.Event(vevent);

        if (event.isRecurring()) {
          // Handle recurring events
          const recurExpansion = new ICAL.RecurExpansion({
            component: vevent,
            dtstart: event.startDate,
          });

          const occurrences = [];
          while (recurExpansion.next()) {
            const occurrenceDate = recurExpansion.last.toJSDate().getTime();

            // Only include occurrences within the specified window
            if (occurrenceDate >= stopRecurringBefore && occurrenceDate <= stopRecurringAfter) {
              occurrences.push({
                summary: event.summary,
                description: event.description || "",
                location: event.location,
                startDate: recurExpansion.last.toJSDate(),
                endDate: new Date(
                  recurExpansion.last.toJSDate().getTime() +
                  (event.endDate.toJSDate().getTime() - event.startDate.toJSDate().getTime())
                ),
              });
            }
          }

          return occurrences;
        } else {
          // Handle non-recurring events

          return [
            {
              summary: event.summary,
              description: event.description || "",
              location: event.location,
              startDate: event.startDate.toJSDate(),
              endDate: event.endDate.toJSDate(),
            },
          ];


        }
      });

      // Sort events by start date
      events.sort((a, b) => a.startDate - b.startDate);

      // Initialize date range for weekly pagination
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0); // Reset to start of today
      let endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7); // 7 days from startDate

      // Update pagination controls
      const prevButton = document.getElementById("prev-page");
      const nextButton = document.getElementById("next-page");
      const pageInfo = document.getElementById("page-info");
      const todayButton = document.getElementById("today-button");
      /* const todayDateStr = today.toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
      });
      todayButton.textContent = todayDateStr; */

      // Function to find the next week with events
      function findNextWeekWithEvents(fromDate) {
        // Guard against empty events array
        if (events.length === 0) return new Date(fromDate);

        let tempStart = new Date(fromDate);
        let tempEnd = new Date(tempStart);
        tempEnd.setDate(tempEnd.getDate() + 7);

        // Safety counter to prevent infinite loops
        let maxIterations = 52; // Maximum 1 year forward (52 weeks)
        let iterations = 0;

        const lastEventDate = new Date(events[events.length - 1].startDate);

        while (iterations < maxIterations) {
          // Check if there are events in this week
          const hasEvents = events.some(event =>
            event.startDate >= tempStart && event.startDate < tempEnd
          );

          if (hasEvents) {
            return tempStart; // Found a week with events
          }

          // If we've gone past the last event, return the current date
          if (tempStart > lastEventDate) {
            return tempStart;
          }

          // Move to next week
          tempStart.setDate(tempStart.getDate() + 7);
          tempEnd.setDate(tempEnd.getDate() + 7);
          iterations++;
        }

        // If we hit the iteration limit, return the current date
        console.warn("Reached maximum iterations in findNextWeekWithEvents");
        return tempStart;
      }

      // Function to find the previous week with events
      function findPrevWeekWithEvents(fromDate) {
        // Guard against empty events array
        if (events.length === 0) return new Date(fromDate);

        let tempStart = new Date(fromDate);
        tempStart.setDate(tempStart.getDate() - 7); // Start one week back
        let tempEnd = new Date(tempStart);
        tempEnd.setDate(tempEnd.getDate() + 7);

        // Safety counter to prevent infinite loops
        let maxIterations = 52; // Maximum 1 year backward (52 weeks)
        let iterations = 0;

        const firstEventDate = new Date(events[0].startDate);

        while (iterations < maxIterations && tempStart >= firstEventDate) {
          // Check if there are events in this week
          const hasEvents = events.some(event =>
            event.startDate >= tempStart && event.startDate < tempEnd
          );

          if (hasEvents) {
            return tempStart; // Found a week with events
          }

          // Move to previous week
          tempStart.setDate(tempStart.getDate() - 7);
          tempEnd.setDate(tempEnd.getDate() - 7);
          iterations++;
        }

        // If we've gone before the first event or hit iteration limit        
        return new Date(firstEventDate);
      }

      // Check if there are any events in the next 7 days
      const hasEventsNextWeek = events.some(event =>
        event.startDate >= startDate && event.startDate < endDate
      );

      // If no events in next 7 days, find the next week with events
      if (!hasEventsNextWeek && events.length > 0) {
        startDate = findNextWeekWithEvents(startDate);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
      }

      prevButton.addEventListener("click", () => {
        startDate = findPrevWeekWithEvents(startDate);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        updateTable();
      });

      nextButton.addEventListener("click", () => {
        startDate.setDate(startDate.getDate() + 7);
        endDate.setDate(endDate.getDate() + 7);

        // Check if there are events in this new week
        const hasEvents = events.some(event =>
          event.startDate >= startDate && event.startDate < endDate
        );

        // If no events, find the next week with events
        if (!hasEvents) {
          startDate = findNextWeekWithEvents(startDate);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
        }

        updateTable();
      });

      todayButton.addEventListener("click", () => {
        // Reset to today
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0); // Reset to start of today
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7); // 7 days from startDate

        // Check if there are events in this week
        const hasEventsThisWeek = events.some(event =>
          event.startDate >= startDate && event.startDate < endDate
        );

        // If no events in the next 7 days, find the next week with events
        if (!hasEventsThisWeek && events.length > 0) {
          startDate = findNextWeekWithEvents(startDate);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
        }

        updateTable();
      });

      function updatePaginationControls() {
        const startDateStr = startDate.toLocaleDateString("en-US", {
          timeZone: "America/New_York"
        });
        const endDateStr = new Date(endDate.getTime() - 1).toLocaleDateString("en-US", {
          timeZone: "America/New_York"
        });

        pageInfo.textContent = `Showing events: ${startDateStr} to ${endDateStr}`;

        // Disable prev button if we're at or before the first event
        prevButton.disabled = startDate <= new Date(events[0].startDate);

        // Disable next button if we're at or after the last event
        const lastEventDate = new Date(events[events.length - 1].startDate);
        nextButton.disabled = startDate > lastEventDate;
      }

      // Function to update the table based on the current date range
      function updateTable() {

        // Clear existing table rows except the header
        const table = document.getElementById("events-table");
        const tbody = table.querySelector("tbody");
        tbody.innerHTML = "";

        // Filter events within the current date range
        const eventsToDisplay = events.filter(event =>
          event.startDate >= startDate && event.startDate < endDate
        );

        // Check if there are events to display
        if (eventsToDisplay.length === 0) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = 4; // Update colspan to match your table
          cell.textContent = "No events in this date range.";
          cell.style.textAlign = "center";
          row.appendChild(cell);
          tbody.appendChild(row);
        } else {

          // Populate the table with the filtered events
          eventsToDisplay.forEach((event) => {
            const eventDate = event.startDate.toLocaleDateString("en-US", {
              timeZone: "America/New_York",
            });
            const eventTime = event.startDate.toLocaleTimeString("en-US", {
              timeZone: "America/New_York",
            });
            const description = event.summary || "-";
            //const routeLink = event.routeLink;

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
            let routeLinks = [];
            // Event cell
            const descCell = document.createElement("td");
            descCell.className = "desc";
            descCell.textContent = description;
            if (event.description) {
              let descDiv = document.createElement("div");
              if (event.description.includes('<br') || event.description.includes('</')) {
                // We are HTML...              
                descDiv.innerHTML = event.description;
              } else {
                // We are plain text...            
                descDiv.innerHTML = event.description.replace(/\n/g, '<br>');
              }
              descDiv.classList.add("detail");
              descCell.appendChild(descDiv);
              descDiv.addEventListener("click", (e) => {
                e.stopPropagation();
              });
              routeLinks = window.extractRouteLinks(event.description);
              /* if (routeLinks.length) {
                console.log(
                  {
                    'description': event.description,
                    'extracted route links': routeLinks,
                    'text content': descDiv.textContent,
                    'html content': descDiv.innerHTML
                  }

                )
              } */
            }
            row.appendChild(descCell);

            // Route cell
            const routeCell = document.createElement("td");
            routeCell.className = "route";



            if (routeLinks.length) {
              for (let routeLink of routeLinks) {
                const link = document.createElement("a");
                link.href = routeLink.link;
                link.target = "_blank";
                link.textContent = routeLink.title;
                link.className = "route-link"; // Add a class for styling
                link.setAttribute("data-tooltip", "View route on Ride with GPS"); // Add tooltip text
                routeCell.appendChild(link);
              }
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
        }

        updatePaginationControls();
      }

      // Initial table update
      updateTable();
    })
    .catch((error) => {
      console.error("Error fetching or parsing iCal data:", error);
    });
});
