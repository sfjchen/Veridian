// Ensure API URL is set so apiBaseUrl module does not throw when imported in tests
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || "http://test.example.com";
