#include <math.h>
#include <stdio.h>

#define HEIGHT 600
#define WIDTH 600

#define CENTER (WIDTH + HEIGHT) / 4
#define RADIUS CENTER - 20

#define POINTXY_1 ((HEIGHT + WIDTH) / 3) / 2
#define POINTXY_2 (HEIGHT + WIDTH) / 3

#define SIDE_SQUARE ((HEIGHT + WIDTH) / 3) / 2

#define CIRCLE_LEVEL 3
#define SQUARE_LEVEL 3

static unsigned circleCount;
static unsigned squareCount;

static void drawCircle(int x, int y, int radius);
static void drawSquare(int x1, int y1, int x2, int y2);
static void drawAllCircles(int x, int y, int radius, unsigned recursionLevel);
static void drawAllSquares(int x1, int y1, int x2, int y2, int side, unsigned recursionLevel);

int main(void) {
    printf("Circulos, nivel %d:\n", CIRCLE_LEVEL);
    drawAllCircles(CENTER, CENTER, RADIUS, CIRCLE_LEVEL);

    printf("Quadrados, nivel %d:\n", SQUARE_LEVEL);
    drawAllSquares(POINTXY_1, POINTXY_1, POINTXY_2, POINTXY_2, SIDE_SQUARE, SQUARE_LEVEL);

    printf("Total: %u circulos e %u quadrados\n", circleCount, squareCount);

    return 0;
}

static void drawCircle(int const x, int const y, int const radius) {
    circleCount++;
    printf("circulo centro (%d, %d) raio %d\n", x, y, radius);
}

static void drawSquare(int const x1, int const y1, int const x2, int const y2) {
    // BREAKPOINT
    squareCount++;
    printf("quadrado (%d, %d) ate (%d, %d)\n", x1, y1, x2, y2);
}

static void drawAllCircles(int const x, int const y, int const radius, unsigned const recursionLevel) {
    int const centerAdjust = (int)(radius / sqrt(8));
    int const newRadius = (radius / 2);

    drawCircle(x, y, radius);

    if (recursionLevel != 0) {
        drawAllCircles(x - centerAdjust, y - centerAdjust, newRadius, recursionLevel - 1);
        drawAllCircles(x + centerAdjust, y - centerAdjust, newRadius, recursionLevel - 1);
        drawAllCircles(x - centerAdjust, y + centerAdjust, newRadius, recursionLevel - 1);
        drawAllCircles(x + centerAdjust, y + centerAdjust, newRadius, recursionLevel - 1);
    }
}

static void drawAllSquares(int const x1, int const y1, int const x2, int const y2, int const side,
                           unsigned const recursionLevel) {
    if (recursionLevel != 0) {
        drawAllSquares(x1 + (side / 4), y1 - (side / 2), x2 - (side / 4), y2 - side, side / 2,
                       recursionLevel - 1);
        drawAllSquares(x1 + (side / 4), y1 + side, x2 - (side / 4), y2 + (side / 2), side / 2,
                       recursionLevel - 1);
        drawAllSquares(x1 - (side / 2), y1 + (side / 4), x2 - side, y2 - (side / 4), side / 2,
                       recursionLevel - 1);
        drawAllSquares(x1 + side, y1 + (side / 4), x2 + (side / 2), y2 - (side / 4), side / 2,
                       recursionLevel - 1);
    }

    drawSquare(x1, y1, x2, y2);
}
