# Requirements Document

## Introduction

The product steering in `.kiro/steering/product.md` lists the forms of the app in step 1 of "The flow". It names four forms. The app has five: `app/src/templates/index.ts` also lists Tool loan. Steering that is out of date misleads every later Kiro run, and today nothing checks it. This spec fixes the steering and adds one test that keeps it right. It adds no app code and changes no file in `core/src/`, `app/src/` or `mcp/src/`.

## Requirements

### Requirement 1: The steering names every form
**User Story:** As a Kiro user, I want the product steering to name every form of the app, so that each run starts with the right picture of the product.

#### Acceptance Criteria
1. WHEN a template is listed in `app/src/templates/index.ts` THEN THE SYSTEM SHALL name its `title` in `.kiro/steering/product.md`, ignoring case.
2. THE product steering SHALL name all five forms today: Rental return, Key handover, Item sold as seen, Tool loan and Blank form.
3. THE product steering SHALL hold no other line that says there are four forms.
4. THE change SHALL keep the file as UTF-8 with no byte order mark and with LF line endings, and SHALL not change any other rule in it.

### Requirement 2: A test keeps the steering right
**User Story:** As the owner, I want a failing test when a form is added and the steering is not updated, so that the steering cannot fall behind again without a red check.

#### Acceptance Criteria
1. WHEN a template is added to `app/src/templates/index.ts` and its title is not in `.kiro/steering/product.md` THEN THE SYSTEM SHALL fail a test in `core/tests/`, and the failure SHALL name the missing title.
2. THE test SHALL read the template files with the file system and SHALL import nothing from `app/`.
3. WHEN the test runs before the steering is fixed THEN it SHALL fail because `product.md` does not name Tool loan. It SHALL not be weakened to pass.
4. THE test SHALL fail, and not pass, if it finds no template in `index.ts` or no title in a template file.
5. THE spec SHALL add no package.
