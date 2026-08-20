CC = gcc
CFLAGS = -g -O0 -Wall -Wextra
BIN_DIR = bin

SOURCES = $(wildcard *.c)
TARGETS = $(patsubst %.c,$(BIN_DIR)/%,$(SOURCES))

.PHONY: all clean

all: $(TARGETS)

$(BIN_DIR)/%: %.c | $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $<

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

clean:
	rm -rf $(BIN_DIR)
