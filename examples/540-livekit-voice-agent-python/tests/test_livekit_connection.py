#!/usr/bin/env python3
"""
Test LiveKit server connection.

This test verifies that:
1. LiveKit credentials are valid
2. Can connect to the LiveKit server

Exit codes:
- 0: All tests passed  
- 1: Test failed
- 2: Missing credentials (skip)
"""

import asyncio
import os
import sys


def check_credentials() -> bool:
    """Check if required credentials are available."""
    missing = []
    
    if not os.environ.get("LIVEKIT_URL"):
        missing.append("LIVEKIT_URL")
    if not os.environ.get("LIVEKIT_API_KEY"):
        missing.append("LIVEKIT_API_KEY")
    if not os.environ.get("LIVEKIT_API_SECRET"):
        missing.append("LIVEKIT_API_SECRET")
        
    if missing:
        print(f"SKIP: Missing LiveKit credentials: {', '.join(missing)}")
        return False
    return True


async def test_livekit_api() -> bool:
    """Test LiveKit API connection by listing rooms."""
    from livekit import api
    
    print("Testing LiveKit API connection...")
    
    try:
        livekit_api = api.LiveKitAPI(
            url=os.environ.get("LIVEKIT_URL"),
            api_key=os.environ.get("LIVEKIT_API_KEY"),
            api_secret=os.environ.get("LIVEKIT_API_SECRET"),
        )
        
        # List rooms to verify connection
        rooms = await livekit_api.room.list_rooms(api.ListRoomsRequest())
        
        print(f"  ✓ Connected to LiveKit server")
        print(f"  - Active rooms: {len(rooms.rooms)}")
        
        await livekit_api.aclose()
        return True
        
    except Exception as e:
        print(f"  ✗ LiveKit API error: {e}")
        return False


async def test_token_generation() -> bool:
    """Test LiveKit access token generation."""
    from livekit import api
    
    print("Testing token generation...")
    
    try:
        api_key = os.environ.get("LIVEKIT_API_KEY")
        api_secret = os.environ.get("LIVEKIT_API_SECRET")
        
        # Create an access token
        token = api.AccessToken(api_key, api_secret)
        token.with_identity("test-agent")
        token.with_name("Test Agent")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room="test-room",
            can_publish=True,
            can_subscribe=True,
        ))
        
        jwt = token.to_jwt()
        
        if jwt and len(jwt) > 100:
            print(f"  ✓ Token generated successfully ({len(jwt)} chars)")
            return True
        else:
            print("  ✗ Token generation produced invalid token")
            return False
            
    except Exception as e:
        print(f"  ✗ Token generation error: {e}")
        return False


async def main() -> int:
    """Run all tests."""
    print("=" * 60)
    print("LiveKit Connection Tests")
    print("=" * 60)
    print()
    
    # Check credentials
    if not check_credentials():
        return 2
    
    results = []
    
    # Run tests
    results.append(await test_token_generation())
    results.append(await test_livekit_api())
    
    print()
    print("=" * 60)
    
    if all(results):
        print("All tests passed! ✓")
        return 0
    else:
        passed = sum(results)
        total = len(results)
        print(f"Tests: {passed}/{total} passed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
