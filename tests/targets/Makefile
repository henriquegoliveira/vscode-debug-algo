CC = gcc
CXX = g++
CFLAGS = -g -O0 -Wall -Wextra
CXXFLAGS = -g -O0 -Wall -Wextra
BIN_DIR = bin

ifeq ($(OS),Windows_NT)
EXE = .exe
CXXFLAGS += -static
else
EXE =
endif

C_SOURCES = $(wildcard */*.c)
CXX_SOURCES = $(wildcard */*.cpp)
SOURCE_DIRS = $(sort $(dir $(C_SOURCES)) $(dir $(CXX_SOURCES)))
BASENAMES = $(basename $(notdir $(C_SOURCES) $(CXX_SOURCES)))
TARGETS = $(addprefix $(BIN_DIR)/,$(addsuffix $(EXE),$(BASENAMES)))

vpath %.c $(SOURCE_DIRS)
vpath %.cpp $(SOURCE_DIRS)

.PHONY: all clean

all: $(TARGETS)

$(BIN_DIR)/%$(EXE): %.c | $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $<

$(BIN_DIR)/%$(EXE): %.cpp | $(BIN_DIR)
	$(CXX) $(CXXFLAGS) -o $@ $<

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

clean:
	rm -rf $(BIN_DIR)
