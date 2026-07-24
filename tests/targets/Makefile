CC = gcc
CFLAGS = -g -Wall
BIN_DIR = bin
 
.PHONY: all clean
 
all: $(BIN_DIR)/linked_list_simple $(BIN_DIR)/linked_list_cyclic
 
$(BIN_DIR)/linked_list_simple: linked_list_simple.c
	@mkdir -p $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $<
 
$(BIN_DIR)/linked_list_cyclic: linked_list_cyclic.c
	@mkdir -p $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $<
 
clean:
	rm -rf $(BIN_DIR)
 
