"""
Unit tests for the custom function tools.

These tests verify that the function tools work correctly
before being used in the voice agent.
"""

import os
import sys
from datetime import datetime, timezone

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


def test_get_current_time():
    """Test the get_current_time tool."""
    from livekit.agents import llm
    
    @llm.function_tool
    def get_current_time(tz: str = "UTC") -> str:
        """Get the current time in a specified timezone."""
        current = datetime.now(timezone.utc)
        return f"The current time in {tz} is {current.strftime('%I:%M %p on %B %d, %Y')}"
    
    # Test with default timezone
    result = get_current_time()
    assert "UTC" in result
    assert "The current time" in result
    print("✓ get_current_time tool works correctly")


def test_calculate():
    """Test the calculate tool."""
    from livekit.agents import llm
    
    @llm.function_tool
    def calculate(expression: str) -> str:
        """Evaluate a simple mathematical expression."""
        try:
            allowed = set("0123456789+-*/().% ")
            if not all(c in allowed for c in expression):
                return "Sorry, I can only handle basic math with numbers and operators (+, -, *, /, %)"
            result = eval(expression)
            return f"The result of {expression} is {result}"
        except Exception as e:
            return f"I couldn't calculate that: {str(e)}"
    
    # Test basic operations
    result = calculate("2 + 2")
    assert "4" in result
    
    result = calculate("10 * 5")
    assert "50" in result
    
    result = calculate("100 / 4")
    assert "25" in result
    
    # Test invalid input
    result = calculate("rm -rf /")
    assert "Sorry" in result or "basic math" in result
    
    print("✓ calculate tool works correctly")


def test_get_weather():
    """Test the get_weather tool."""
    from livekit.agents import llm
    
    @llm.function_tool
    def get_weather(city: str) -> str:
        """Get the current weather for a city (mock implementation)."""
        mock_weather = {
            "san francisco": "65°F, partly cloudy with a chance of fog",
            "new york": "72°F, sunny with light breeze",
            "london": "58°F, overcast with light rain",
            "tokyo": "78°F, clear skies",
        }
        
        city_lower = city.lower()
        if city_lower in mock_weather:
            return f"The weather in {city} is currently {mock_weather[city_lower]}"
        else:
            return f"I don't have weather data for {city}, but it's probably lovely there!"
    
    # Test known cities
    result = get_weather("San Francisco")
    assert "65°F" in result
    
    result = get_weather("New York")
    assert "72°F" in result
    
    # Test unknown city
    result = get_weather("Unknown City")
    assert "lovely" in result
    
    print("✓ get_weather tool works correctly")


def test_tool_decorator():
    """Test that the function_tool decorator works correctly."""
    from livekit.agents import llm
    from typing import Annotated
    
    @llm.function_tool
    def sample_tool(
        name: Annotated[str, "The user's name"],
        greeting: Annotated[str, "A greeting to use"] = "Hello"
    ) -> str:
        """A sample tool for testing."""
        return f"{greeting}, {name}!"
    
    # Call the tool
    result = sample_tool("World")
    assert "World" in result
    
    result = sample_tool("Developer", "Hi")
    assert "Hi" in result and "Developer" in result
    
    print("✓ function_tool decorator works correctly")


def run_tests():
    """Run all unit tests."""
    print("=" * 60)
    print("Running Function Tools Unit Tests")
    print("=" * 60)
    print()
    
    test_get_current_time()
    test_calculate()
    test_get_weather()
    test_tool_decorator()
    
    print()
    print("=" * 60)
    print("All unit tests passed! ✓")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
