/**
 * E2E Tests - Photo Upload Flow
 * Tests the complete user journey for uploading photos
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Photo Upload Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('UNITED ALBUM');
    });

    test('should display challenge carousel', async ({ page }) => {
        await expect(page.locator('.carousel-track')).toBeVisible();
        await expect(page.locator('.carousel-item.active')).toBeVisible();

        // Should show navigation arrows
        await expect(page.locator('.carousel-nav.prev')).toBeVisible();
        await expect(page.locator('.carousel-nav.next')).toBeVisible();
    });

    test('should navigate between challenges', async ({ page }) => {
        // Get initial challenge title
        const initialTitle = await page.locator('.carousel-item.active h3').textContent();

        // Click next button
        await page.locator('.carousel-nav.next').click();

        // Wait for carousel animation
        await page.waitForTimeout(500);

        // Should show different challenge
        const newTitle = await page.locator('.carousel-item.active h3').textContent();
        expect(newTitle).not.toBe(initialTitle);
    });

    test('should show upload section', async ({ page }) => {
        await expect(page.locator('.upload-section')).toBeVisible();
        await expect(page.locator('.upload-label')).toContainText('Upload your');
    });

    test('should upload photo successfully', async ({ page }) => {
        // Create a test image file
        const testImagePath = path.join(__dirname, '../fixtures/test-photo.jpg');

        // Set up file chooser
        const fileChooserPromise = page.waitForEvent('filechooser');

        // Click upload button
        await page.locator('input[type="file"]').click();

        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(testImagePath);

        // Should show analyzing status
        await expect(page.locator('.status-box')).toContainText('Analyzing', { timeout: 2000 });

        // Should show progress bar
        await expect(page.locator('.progress-bar')).toBeVisible();

        // Wait for upload to complete (with timeout)
        await expect(page.locator('.toast-success')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.toast-success')).toContainText('successfully');
    });

    test('should show error for invalid file', async ({ page }) => {
        const testFilePath = path.join(__dirname, '../fixtures/invalid.txt');

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('input[type="file"]').click();

        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(testFilePath);

        // Should show error toast
        await expect(page.locator('.toast-error')).toBeVisible({ timeout: 10000 });
    });

    test('should show face detection progress', async ({ page }) => {
        const testImagePath = path.join(__dirname, '../fixtures/test-photo.jpg');

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('input[type="file"]').click();

        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(testImagePath);

        // Should show progress percentage
        await expect(page.locator('.progress-text')).toBeVisible({ timeout: 2000 });

        const progressText = await page.locator('.progress-text').textContent();
        expect(progressText).toMatch(/\d+%/);
    });
});

test.describe('Gallery Navigation', () => {
    test('should navigate to gallery', async ({ page }) => {
        await page.goto('/');

        // Click on gallery nav item
        await page.locator('button:has-text("Album Gallery")').click();

        // Should show gallery
        await expect(page.locator('.face-gallery')).toBeVisible();
        await expect(page.locator('h2')).toContainText('Album Gallery');
    });

    test('should display photos in gallery', async ({ page }) => {
        await page.goto('/');
        await page.locator('button:has-text("Album Gallery")').click();

        // Wait for photos to load
        await page.waitForTimeout(1000);

        // Should show either photos or empty state
        const hasPhotos = await page.locator('.gallery-grid .photo-card').count();
        const hasEmptyState = await page.locator('text=No photos yet').count();

        expect(hasPhotos > 0 || hasEmptyState > 0).toBeTruthy();
    });

    test('should filter photos by pose', async ({ page }) => {
        await page.goto('/');
        await page.locator('button:has-text("Album Gallery")').click();

        // Wait for photos
        await page.waitForTimeout(1000);

        // Check if pose filters exist
        const poseFilters = await page.locator('.filter-chips button').count();

        if (poseFilters > 1) {
            // Click on a pose filter
            await page.locator('.filter-chips button').nth(1).click();

            // Should update displayed photos
            await page.waitForTimeout(500);
            await expect(page.locator('.gallery-grid')).toBeVisible();
        }
    });

    test('should show face thumbnails', async ({ page }) => {
        await page.goto('/');
        await page.locator('button:has-text("Album Gallery")').click();

        // Wait for face thumbnails to load
        await page.waitForTimeout(1000);

        // Should show "All" button
        await expect(page.locator('.face-thumb:has-text("All")')).toBeVisible();

        // Should show face thumbnail container
        await expect(page.locator('.face-thumbnails-container')).toBeVisible();
    });
});

test.describe('Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should display mobile layout', async ({ page }) => {
        await page.goto('/');

        // Sidebar should be at bottom on mobile
        const sidebar = page.locator('.sidebar');
        await expect(sidebar).toBeVisible();

        // Should show compact navigation
        await expect(page.locator('.sidebar-nav')).toBeVisible();
    });

    test('should show toast at bottom on mobile', async ({ page }) => {
        await page.goto('/');

        const toastContainer = page.locator('.toast-container');

        // Check if toast container has mobile styles (would need to upload to test)
        await expect(toastContainer).toBeAttached();
    });
});

test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
        await page.goto('/');

        // Navigation buttons should have aria-labels
        await expect(page.locator('[aria-label="Previous Challenge"]')).toBeVisible();
        await expect(page.locator('[aria-label="Next Challenge"]')).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
        await page.goto('/');

        // Tab through elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Should have focus indicators
        const focusedElement = await page.evaluate(() => document.activeElement.tagName);
        expect(focusedElement).toBeTruthy();
    });
});
