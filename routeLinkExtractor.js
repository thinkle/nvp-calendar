/**
 * Extracts route links and their titles from a given description.
 * @param {string} description - The event description containing route links.
 * @returns {Array} - An array of objects, each containing a `title` and `link`.
 */
function normalizeHtml(html) {
  if (html.includes("<br>")) {
    html = html.replace(/<br>/g, "\n");
  }
  if (html.includes("<br/>")) {
    html = html.replace(/<br\/>/g, "\n");
  }
  if (html.includes("<p>")) {
    html = html.replace(/<p\/>/g, "\n").replace(/<\/p>/g, "\n");
  }
  html = html.replace(/<[^>]+>/g, ""); // Remove all remaining HTML tags
  return html;
}

function extractRouteLinks(description) {
  description = normalizeHtml(description);

  if (!description) return [];

  // Regex to match links and their potential titles
  const routeRegex = /(?:([^\n]*?)\s*[:\-]?\s*)?(https?:\/\/ridewithgps\.com\/[^\s]+)/gi;

  // Extract matches
  const matches = [...description.matchAll(routeRegex)];

  const routeLinks = [];
  let lastTitle = null;

  matches.forEach((match) => {
    const potentialTitle = match[1]?.trim();
    const link = match[2];

    // If the potential title is itself a link, treat it as standalone
    if (potentialTitle && potentialTitle.startsWith("http")) {
      routeLinks.push({ title: "Route", link });
      lastTitle = null; // Reset last title
    } else if (potentialTitle) {
      // If there's a meaningful title, use it
      routeLinks.push({ title: potentialTitle, link });
      lastTitle = potentialTitle;
    } else if (lastTitle) {
      // If no title and we have a previous meaningful title, use "Route"
      routeLinks.push({ title: "Route", link });
    } else {
      // Otherwise, treat as standalone
      routeLinks.push({ title: "Route", link });
    }
  });

  if (routeLinks.length == 1) {
    // If there's only one link, give it a more generic title
    routeLinks[0].title = "Route";
  }

  return routeLinks;
}

// Attach to the global `window` object for use in other scripts
window.extractRouteLinks = extractRouteLinks;

