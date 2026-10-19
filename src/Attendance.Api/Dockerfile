FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files
COPY ["src/Attendance.Domain/Attendance.Domain.csproj", "Attendance.Domain/"]
COPY ["src/Attendance.Application/Attendance.Application.csproj", "Attendance.Application/"]
COPY ["src/Attendance.Infrastructure/Attendance.Infrastructure.csproj", "Attendance.Infrastructure/"]
COPY ["src/Attendance.Biometrics/Attendance.Biometrics.csproj", "Attendance.Biometrics/"]
COPY ["src/Attendance.Api/Attendance.Api.csproj", "Attendance.Api/"]

# Restore
RUN dotnet restore "Attendance.Api/Attendance.Api.csproj"

# Copy source and build
COPY src/ .
WORKDIR "/src/Attendance.Api"
RUN dotnet publish "Attendance.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Attendance.Api.dll"]
