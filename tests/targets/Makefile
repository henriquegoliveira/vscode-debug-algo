CC = gcc
CXX = g++
CFLAGS = -g -O0 -Wall -Wextra
CXXFLAGS = -g -O0 -Wall -Wextra
BIN_DIR = bin

C_SOURCES = $(wildcard *.c)
CXX_SOURCES = $(wildcard *.cpp)
TARGETS = $(patsubst %.c,$(BIN_DIR)/%,$(C_SOURCES)) $(patsubst %.cpp,$(BIN_DIR)/%,$(CXX_SOURCES))

.PHONY: all clean

all: $(TARGETS)

$(BIN_DIR)/%: %.c | $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $<

$(BIN_DIR)/%: %.cpp | $(BIN_DIR)
	$(CXX) $(CXXFLAGS) -o $@ $<

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

clean:
	rm -rf $(BIN_DIR)
