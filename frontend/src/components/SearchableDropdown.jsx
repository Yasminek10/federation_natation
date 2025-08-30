import React, { useState } from "react";
import { Dropdown, FormControl } from "react-bootstrap";

export default function SearchableDropdown({ title, items, onSelect, formatItem }) {
  const [search, setSearch] = useState("");

  const filteredItems = items.filter((item) =>
    formatItem(item).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dropdown>
      <Dropdown.Toggle variant="secondary">{title}</Dropdown.Toggle>
      <Dropdown.Menu style={{ maxHeight: "300px", overflowY: "auto" }}>
        <FormControl
          autoFocus
          placeholder="Rechercher..."
          className="mx-3 my-2 w-auto"
          onChange={(e) => setSearch(e.target.value)}
          value={search}
        />
        <div className="px-2">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => (
              <Dropdown.Item
                key={idx}
                onClick={() => {
                  onSelect(item);
                  setSearch("");
                }}
              >
                {formatItem(item)}
              </Dropdown.Item>
            ))
          ) : (
            <Dropdown.Item disabled>Aucun élément</Dropdown.Item>
          )}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
}
