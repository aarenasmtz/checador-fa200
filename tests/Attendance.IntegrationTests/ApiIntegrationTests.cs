using Attendance.Application.DTOs;
using Attendance.Domain.Enums;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Attendance.IntegrationTests;

public class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task HealthEndpoint_ShouldReturnHealthy()
    {
        // Act
        var response = await _client.GetAsync("/health");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Be("Healthy");
    }

    [Fact]
    public async Task Login_WithValidCredentials_ShouldReturnOkAndJwtToken()
    {
        // Arrange
        var request = new { username = "admin", password = "Admin123!" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        body.TryGetProperty("accessToken", out var token).Should().BeTrue();
        token.GetString().Should().NotBeNullOrWhiteSpace();

        body.TryGetProperty("user", out var user).Should().BeTrue();
        user.GetProperty("username").GetString().Should().Be("admin");
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_ShouldReturnUnauthorized()
    {
        // Arrange
        var request = new { username = "admin", password = "WrongPassword999!" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetBranches_WithoutAuthorizationHeader_ShouldReturnUnauthorized()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/branches");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task IngestSimulatorEvent_ShouldProcessSuccessfullyAndReturnHash()
    {
        // Arrange
        var eventRequest = new
        {
            DeviceCode = "FA200-CENTRO-01",
            EmployeeCode = "EMP0001",
            Timestamp = DateTime.UtcNow,
            Method = "Face",
            Type = "CheckIn"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/devices/simulator/events", eventRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        body.TryGetProperty("eventHash", out var hash).Should().BeTrue();
        hash.GetString().Should().NotBeNullOrWhiteSpace();
        body.GetProperty("isDuplicate").GetBoolean().Should().BeFalse();
    }
}
