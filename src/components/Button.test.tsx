import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button, SecondaryButton, TertiaryButton } from "./Button";

describe("Button Component", () => {
  it("should render with label", () => {
    render(<Button label="Test Button" onPress={() => {}} />);
    expect(screen.getByText("Test Button")).toBeDefined();
  });

  it("should call onPress when tapped", () => {
    const onPress = jest.fn();
    render(<Button label="Test" onPress={onPress} />);

    const button = screen.getByText("Test");
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalled();
  });

  it("should be disabled when disabled prop is true", () => {
    const onPress = jest.fn();
    render(<Button label="Test" onPress={onPress} disabled={true} />);

    const button = screen.getByText("Test");
    fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it("should show loading indicator when loading", () => {
    render(<Button label="Test" onPress={() => {}} loading={true} />);
    // ActivityIndicator would be rendered
    expect(screen.queryByText("Test")).toBeNull();
  });

  it("should render secondary variant", () => {
    render(<SecondaryButton label="Secondary" onPress={() => {}} />);
    expect(screen.getByText("Secondary")).toBeDefined();
  });

  it("should render tertiary variant", () => {
    render(<TertiaryButton label="Tertiary" onPress={() => {}} />);
    expect(screen.getByText("Tertiary")).toBeDefined();
  });
});
