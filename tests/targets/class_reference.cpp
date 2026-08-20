#include <cstdio>
#include <cstdint>

class Shape {
public:
    Shape(int const identifier);
    virtual ~Shape();
    virtual double area() const;
    int getIdentifier() const;

protected:
    int identifier;

private:
    uint8_t visible;
};

class Rectangle : public Shape {
public:
    Rectangle(int const identifier, double const width, double const height);
    ~Rectangle() override;
    double area() const override;

    Rectangle *next;

private:
    double width;
    double height;
    char label[8];
};

class Square : public Rectangle {
public:
    Square(int const identifier, double const side);
    double area() const override;

private:
    double side;
};

static Rectangle *buildChain(void);
static void destroyChain(Rectangle *ptHead);
static void traverse(Rectangle *ptHead, int &counter);
static void inspect(Rectangle &nodeRef, Shape const &shapeRef, int &counterRef);

int main(void) {
    Rectangle *ptHead = buildChain();
    int counter = 0;

    traverse(ptHead, counter);

    printf("Formas visitadas: %d\n", counter);

    destroyChain(ptHead);

    return 0;
}

Shape::Shape(int const identifier) : identifier(identifier), visible(1) {}

Shape::~Shape() {}

double Shape::area() const {
    return 0.0;
}

int Shape::getIdentifier() const {
    return identifier;
}

Rectangle::Rectangle(int const identifier, double const width, double const height)
    : Shape(identifier), next(nullptr), width(width), height(height), label{0} {
    snprintf(label, sizeof(label), "R%d", identifier);
}

Rectangle::~Rectangle() {}

double Rectangle::area() const {
    return width * height;
}

Square::Square(int const identifier, double const side)
    : Rectangle(identifier, side, side), side(side) {}

double Square::area() const {
    return side * side;
}

static Rectangle *buildChain(void) {
    Rectangle *ptHead = new Rectangle(1, 4.0, 3.0);

    ptHead->next = new Square(2, 5.0);
    ptHead->next->next = new Rectangle(3, 2.5, 8.0);

    return ptHead;
}

static void destroyChain(Rectangle *ptHead) {
    while (ptHead != nullptr) {
        Rectangle *ptrAux = ptHead->next;

        delete ptHead;
        ptHead = ptrAux;
    }
}

static void traverse(Rectangle *ptHead, int &counter) {
    Rectangle *pt = ptHead;

    while (pt != nullptr) {
        inspect(*pt, *pt, counter);
        pt = pt->next;
    }
}

static void inspect(Rectangle &nodeRef, Shape const &shapeRef, int &counterRef) {
    double const measured = shapeRef.area();

    counterRef++;

    // BREAKPOINT
    printf("Forma %d area %.2f (%s)\n", shapeRef.getIdentifier(), measured,
           nodeRef.next != nullptr ? "tem proximo" : "ultimo");
}
