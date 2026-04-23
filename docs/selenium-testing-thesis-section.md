# Selenium Testing Report

## Overview

Selenium WebDriver testing was conducted to verify the user-facing behaviour of the CoResearch web application. The purpose of the test suite was to validate the main browser workflows, form behaviour, navigation paths, access-control redirects, error handling, and responsive layout behaviour from the perspective of an end user.

The test suite was implemented using Selenium WebDriver with Node.js built-in test runner. The application was executed locally using the Next.js development server, and the tests were run against a real browser in headless mode.

## Test Environment

| Item | Description |
|---|---|
| Application | CoResearch collaborative research platform |
| Framework | Next.js 16.1.5 |
| Test tool | Selenium WebDriver |
| Selenium package version | 4.43.0 |
| Test runner | Node.js `node:test` |
| Execution mode | Headless browser automation |
| Local test URL | `http://127.0.0.1:3000` |
| Test command | `npm.cmd run test:selenium:local` |
| Test date | 21 April 2026 |

## Scope of Testing

The Selenium tests covered the application areas that can be reliably verified without requiring a pre-authenticated Firebase user session. This included public authentication screens, registration navigation, browser-level input validation, protected-route redirection, custom error page behaviour, and responsive layout checks.

Authenticated workflows such as creating research papers, approving users, realtime chat, and collaboration features require seeded test users and controlled Firebase test data. These workflows were therefore identified as suitable candidates for future end-to-end testing with a dedicated test database and test credentials.

## Test Cases and Results

| Test ID | Test Area | Test Case | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| ST-01 | Login | Render student login page | Student login heading, email field, password field, and continue button are displayed | Page rendered correctly | Pass |
| ST-02 | Login | Switch to university admin form | University admin heading and admin email placeholder are displayed | Form switched correctly | Pass |
| ST-03 | Login | Switch back to student form | Student heading and student email placeholder are restored | Form switched correctly | Pass |
| ST-04 | Login validation | Submit empty login form | Browser required-field validation prevents submission | Invalid email field detected | Pass |
| ST-05 | Login validation | Enter malformed email | Browser email validation prevents submission | Invalid email format detected | Pass |
| ST-06 | Login input | Type into login fields | Email and password inputs preserve entered values | Values were retained | Pass |
| ST-07 | Registration navigation | Open registration from login page | User is routed to `/register` and sees student registration content | Registration page opened | Pass |
| ST-08 | Registration form | Render registration fields | Name, email, password, university, student ID, year, program, and interests fields are displayed | All expected fields displayed | Pass |
| ST-09 | Registration navigation | Return from registration to sign-in | User is routed back to `/` and sees student login page | Login page opened | Pass |
| ST-10 | Route protection | Access `/dashboard` while unauthenticated | User is redirected to login page | Redirect completed | Pass |
| ST-11 | Route protection | Access `/discover` while unauthenticated | User is redirected to login page | Redirect completed | Pass |
| ST-12 | Route protection | Access `/admin` while unauthenticated | User is redirected away from admin area and back to login | Redirect completed | Pass |
| ST-13 | Route protection | Access `/verification-status` while unauthenticated | User is redirected to login page | Redirect completed | Pass |
| ST-14 | Route protection | Access `/document/new` while unauthenticated | User is redirected to login page | Redirect completed | Pass |
| ST-15 | Error handling | Open invalid route | Custom "Page Not Found" screen is displayed | Error page displayed | Pass |
| ST-16 | Error navigation | Use "Go to Dashboard" from error page while unauthenticated | User is routed through protected dashboard and returned to login | Redirect completed | Pass |
| ST-17 | Responsive layout | Desktop login layout | Page has no horizontal overflow at 1280 x 900 viewport | No overflow detected | Pass |
| ST-18 | Responsive layout | Mobile login layout | Page has no horizontal overflow at 390 x 844 viewport | No overflow detected | Pass |
| ST-19 | Responsive layout | Mobile registration layout | Registration page has no horizontal overflow at 390 x 844 viewport | No overflow detected | Pass |

## Execution Summary

| Metric | Result |
|---|---|
| Total Selenium test cases | 19 |
| Passed | 19 |
| Failed | 0 |
| Skipped | 0 |
| Pass rate | 100% |

The executed Selenium test suite passed successfully. The results indicate that the public authentication workflow, registration navigation, unauthenticated route protection, error-page behaviour, and responsive layout checks functioned as expected during testing.

## Conclusion

The Selenium testing confirmed that the CoResearch application provides correct behaviour for key browser-based workflows available before authentication. The application successfully rendered the login and registration interfaces, enforced browser-level form validation, protected restricted routes from unauthenticated access, displayed a custom page for invalid routes, and maintained responsive layouts on both desktop and mobile viewport sizes.

For future testing, the suite can be extended with seeded Firebase test accounts to cover authenticated workflows such as student registration submission, admin approval, dashboard project management, research paper editing, publication, discover search, and realtime knowledge-sharing chat.
