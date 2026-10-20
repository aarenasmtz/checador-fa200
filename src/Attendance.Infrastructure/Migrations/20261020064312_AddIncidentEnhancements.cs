using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIncidentEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BiometricEvents_Employees_EmployeeId",
                table: "BiometricEvents");

            migrationBuilder.AlterColumn<decimal>(
                name: "ExpectedHours",
                table: "Schedules",
                type: "decimal(4,2)",
                precision: 4,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.AddColumn<TimeSpan>(
                name: "EntryWindowEnd",
                table: "Schedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "EntryWindowStart",
                table: "Schedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "ExitWindowEnd",
                table: "Schedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "ExitWindowStart",
                table: "Schedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasMealBreak",
                table: "Schedules",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsOvernight",
                table: "Schedules",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "MealBreakMode",
                table: "Schedules",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MealDurationMinutes",
                table: "Schedules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "MealExitWindowEnd",
                table: "Schedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "MealExitWindowStart",
                table: "Schedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "MealReturnWindowEnd",
                table: "Schedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "MealReturnWindowStart",
                table: "Schedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MealToleranceMinutes",
                table: "Schedules",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "EmployeeId",
                table: "BiometricEvents",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "ClassifiedAs",
                table: "BiometricEvents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NativePunchCode",
                table: "BiometricEvents",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "UserClockId",
                table: "BiometricEvents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastErrorMessage",
                table: "BiometricDevices",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSyncAt",
                table: "BiometricDevices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PendingQueueCount",
                table: "BiometricDevices",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "AttendanceIncidents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "AttendanceIncidents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancelledBy",
                table: "AttendanceIncidents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "AttendanceIncidents",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "AttendanceIncidents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PunchMovementType",
                table: "AttendanceIncidents",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "PunchTime",
                table: "AttendanceIncidents",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "AttendanceIncidents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClassificationOrigin",
                table: "AttendanceDailies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "ExpectedMealEnd",
                table: "AttendanceDailies",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "ExpectedMealStart",
                table: "AttendanceDailies",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsManualOverride",
                table: "AttendanceDailies",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "MealDurationMinutes",
                table: "AttendanceDailies",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MealMinutesLate",
                table: "AttendanceDailies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ModificationReason",
                table: "AttendanceDailies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ModifiedAt",
                table: "AttendanceDailies",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "AttendanceDailies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Origin",
                table: "AttendanceDailies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalStatus",
                table: "AttendanceDailies",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresReview",
                table: "AttendanceDailies",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ReviewNotes",
                table: "AttendanceDailies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BiometricEvents_Employees_EmployeeId",
                table: "BiometricEvents",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BiometricEvents_Employees_EmployeeId",
                table: "BiometricEvents");

            migrationBuilder.DropColumn(
                name: "EntryWindowEnd",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "EntryWindowStart",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "ExitWindowEnd",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "ExitWindowStart",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "HasMealBreak",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "IsOvernight",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "MealBreakMode",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "MealDurationMinutes",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "MealExitWindowEnd",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "MealExitWindowStart",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "MealReturnWindowEnd",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "MealReturnWindowStart",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "MealToleranceMinutes",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "ClassifiedAs",
                table: "BiometricEvents");

            migrationBuilder.DropColumn(
                name: "NativePunchCode",
                table: "BiometricEvents");

            migrationBuilder.DropColumn(
                name: "UserClockId",
                table: "BiometricEvents");

            migrationBuilder.DropColumn(
                name: "LastErrorMessage",
                table: "BiometricDevices");

            migrationBuilder.DropColumn(
                name: "LastSyncAt",
                table: "BiometricDevices");

            migrationBuilder.DropColumn(
                name: "PendingQueueCount",
                table: "BiometricDevices");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "AttendanceIncidents");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "AttendanceIncidents");

            migrationBuilder.DropColumn(
                name: "CancelledBy",
                table: "AttendanceIncidents");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "AttendanceIncidents");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "AttendanceIncidents");

            migrationBuilder.DropColumn(
                name: "PunchMovementType",
                table: "AttendanceIncidents");

            migrationBuilder.DropColumn(
                name: "PunchTime",
                table: "AttendanceIncidents");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "AttendanceIncidents");

            migrationBuilder.DropColumn(
                name: "ClassificationOrigin",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "ExpectedMealEnd",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "ExpectedMealStart",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "IsManualOverride",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "MealDurationMinutes",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "MealMinutesLate",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "ModificationReason",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "ModifiedAt",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "Origin",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "OriginalStatus",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "RequiresReview",
                table: "AttendanceDailies");

            migrationBuilder.DropColumn(
                name: "ReviewNotes",
                table: "AttendanceDailies");

            migrationBuilder.AlterColumn<decimal>(
                name: "ExpectedHours",
                table: "Schedules",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(4,2)",
                oldPrecision: 4,
                oldScale: 2);

            migrationBuilder.AlterColumn<int>(
                name: "EmployeeId",
                table: "BiometricEvents",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BiometricEvents_Employees_EmployeeId",
                table: "BiometricEvents",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
