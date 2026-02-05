import type { Tool, ToolResult } from '../../src/types.js';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilySearchResult[];
  answer?: string;
}

/**
 * Web search using Tavily API
 */
const webSearchTool: Tool = {
  name: 'webSearch',
  description: 'Search the web for information using Tavily',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results (default: 5)',
      },
    },
    required: ['query'],
  },
  execute: async (params): Promise<ToolResult> => {
    const { query, maxResults = 5 } = params as { query: string; maxResults?: number };

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'TAVILY_API_KEY not set. Please set it in your environment.',
      };
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          max_results: maxResults,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Tavily API error: ${response.status} - ${error}`,
        };
      }

      const data = await response.json() as TavilyResponse;

      return {
        success: true,
        data: {
          results: data.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
            score: r.score,
          })),
          answer: data.answer,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Fetch and extract content from a web page
 */
const fetchPageTool: Tool = {
  name: 'fetchPage',
  description: 'Fetch and extract readable content from a web page',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
    },
    required: ['url'],
  },
  execute: async (params): Promise<ToolResult> => {
    const { url } = params as { url: string };

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Jarvis-Research-Agent/1.0',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch page: ${response.status} ${response.statusText}`,
        };
      }

      const html = await response.text();

      // Basic HTML to text extraction
      // In production, you'd want a proper HTML parser like cheerio
      const text = html
        // Remove script and style content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Decode common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim();

      // Truncate to reasonable length
      const maxLength = 10000;
      const content = text.length > maxLength
        ? text.slice(0, maxLength) + '... (truncated)'
        : text;

      return {
        success: true,
        data: {
          url,
          content,
          length: text.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch page: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Export all research tools
 */
export const tools: Record<string, Tool> = {
  webSearch: webSearchTool,
  fetchPage: fetchPageTool,
};
