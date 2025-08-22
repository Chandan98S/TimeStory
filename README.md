# TimeStory

A Node.js API that fetches and extracts the latest news stories from [Time.com](https://time.com) using lenient HTML parsing. The application exposes simple HTTP endpoints to get the latest articles and debug the extraction process.

## Features

- **Fetches the Latest News:** Scrapes [Time.com](https://time.com) for recent article links and titles.
- **Lenient Extraction:** Uses robust heuristics to filter non-article links and extract meaningful story titles.
- **REST API:** Exposes endpoints to retrieve stories or debug the extraction process.
- **CORS Support:** Allows cross-origin requests for easy frontend integrations.

## Endpoints

- `GET /getTimeStories`  
  Returns the latest 6 news stories with title and link in JSON format.

- `GET /debug`  
  Returns additional debug information including raw HTML length, number of stories found, and the extracted stories.

- `GET /`  
  Shows a welcome message and available endpoints.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/Chandan98S/TimeStory.git
   cd TimeStory
   ```

2. Install dependencies (if any are added for logging, etc.):
   ```bash
   npm install
   ```
   > Note: The basic script does not require any additional npm packages.

### Running the Server

```bash
node server.js
```

By default, the server runs on port `3000`. You can specify a different port by setting the `PORT` environment variable.

### Example Usage

```bash
curl http://localhost:3000/getTimeStories
```

Output:
```json
[
  {
    "title": "Latest Major Headline",
    "link": "https://time.com/..."
  },
  ...
]
```

## Project Structure

- `server.js` — Main server file containing all logic for fetching, parsing, and serving the news stories.

## How It Works

- Fetches the homepage HTML of time.com.
- Extracts all links, applies filters to exclude non-articles, and heuristically determines article titles.
- Returns up to 6 of the most prominent recent articles.

## Customization

- **Number of stories:** Edit the value in the code (`stories.length < 6`) to increase/decrease the number of stories returned.
- **Filtering:** Adjust the `excludePatterns` array to filter out additional or fewer link types as needed.

## Author

[Chandan98S](https://github.com/Chandan98S)

---

Let me know if you want to add badges, contribution guidelines, or anything else!
